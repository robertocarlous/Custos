// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OracleGuard} from "./OracleGuard.sol";

/// @title ReferenceLendingPool
/// @notice Minimal single collateral / single borrow asset lending pool, built to
///         demonstrate correct OracleGuard integration -- not a production money market
///         (no interest accrual, no multi-asset support). Collateral is a Robinhood
///         Stock Token priced in USD (8 decimals) via OracleGuard; the borrow asset is
///         assumed to be a USD-pegged 18-decimal stable.
contract ReferenceLendingPool {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 private constant PRICE_DECIMALS = 1e8;

    IERC20 public immutable collateralToken;
    IERC20 public immutable borrowToken;
    OracleGuard public immutable oracleGuard;

    /// @notice Max borrow value allowed as a fraction of collateral value, in bps.
    uint256 public immutable maxLtvBps;
    /// @notice Collateral/debt ratio below which a position becomes liquidatable, in bps.
    uint256 public immutable liquidationThresholdBps;
    /// @notice Extra collateral (on top of debt repaid) paid to liquidators, in bps.
    uint256 public immutable liquidationBonusBps;

    mapping(address => uint256) public collateralBalanceOf;
    mapping(address => uint256) public borrowBalanceOf;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, address indexed payer, uint256 amount);
    event Liquidate(
        address indexed borrower, address indexed liquidator, uint256 repayAmount, uint256 collateralSeized
    );

    error ZeroAmount();
    error InsufficientCollateralBalance();
    error InsufficientBorrowBalance();
    error PositionWouldBeUnhealthy();
    error OraclePriceUnsafe(OracleGuard.Reason reason);
    error LiquidationNotAllowed(OracleGuard.Reason reason);
    error PositionIsHealthy();
    error RepayExceedsRequired();

    constructor(
        address _collateralToken,
        address _borrowToken,
        address _oracleGuard,
        uint256 _maxLtvBps,
        uint256 _liquidationThresholdBps,
        uint256 _liquidationBonusBps
    ) {
        collateralToken = IERC20(_collateralToken);
        borrowToken = IERC20(_borrowToken);
        oracleGuard = OracleGuard(_oracleGuard);
        maxLtvBps = _maxLtvBps;
        liquidationThresholdBps = _liquidationThresholdBps;
        liquidationBonusBps = _liquidationBonusBps;
    }

    // ---------------------------------------------------------------------
    // Collateral
    // ---------------------------------------------------------------------

    function depositCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        collateralBalanceOf[msg.sender] += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (collateralBalanceOf[msg.sender] < amount) revert InsufficientCollateralBalance();

        collateralBalanceOf[msg.sender] -= amount;
        if (!_isWithinMaxLtv(msg.sender)) revert PositionWouldBeUnhealthy();

        collateralToken.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Borrow / repay
    // ---------------------------------------------------------------------

    function borrow(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        (,bool isSafe, OracleGuard.Reason reason) = oracleGuard.getSafePrice(address(collateralToken));
        if (!isSafe) revert OraclePriceUnsafe(reason);

        borrowBalanceOf[msg.sender] += amount;
        if (!_isWithinMaxLtv(msg.sender)) revert PositionWouldBeUnhealthy();

        borrowToken.safeTransfer(msg.sender, amount);
        emit Borrow(msg.sender, amount);
    }

    function repay(address borrower, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 debt = borrowBalanceOf[borrower];
        if (amount > debt) revert InsufficientBorrowBalance();

        borrowBalanceOf[borrower] = debt - amount;
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Repay(borrower, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Liquidation
    // ---------------------------------------------------------------------

    /// @notice Repay part of `borrower`'s debt in exchange for their collateral plus a bonus.
    /// @dev Gated on OracleGuard.isLiquidationAllowed() first: liquidations never execute
    ///      while the sequencer is down, the Stock Token oracle is paused, or the price is
    ///      stale by the calendar-aware threshold -- regardless of what the stale price
    ///      would otherwise suggest about the position's health.
    function liquidate(address borrower, uint256 repayAmount) external {
        (bool allowed, OracleGuard.Reason reason) = oracleGuard.isLiquidationAllowedDetailed(address(collateralToken));
        if (!allowed) revert LiquidationNotAllowed(reason);

        if (_isAboveLiquidationThreshold(borrower)) revert PositionIsHealthy();

        uint256 debt = borrowBalanceOf[borrower];
        if (repayAmount > debt) revert RepayExceedsRequired();

        (int256 price,,) = oracleGuard.getSafePrice(address(collateralToken));

        // collateral seized = repayAmount (in USD terms) converted to collateral units,
        // grossed up by the liquidation bonus.
        uint256 collateralToSeize = (repayAmount * PRICE_DECIMALS * (BPS + liquidationBonusBps)) / (uint256(price) * BPS);
        if (collateralToSeize > collateralBalanceOf[borrower]) {
            collateralToSeize = collateralBalanceOf[borrower];
        }

        borrowBalanceOf[borrower] = debt - repayAmount;
        collateralBalanceOf[borrower] -= collateralToSeize;

        borrowToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        collateralToken.safeTransfer(msg.sender, collateralToSeize);

        emit Liquidate(borrower, msg.sender, repayAmount, collateralToSeize);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function isHealthy(address user) external view returns (bool) {
        return _isAboveLiquidationThreshold(user);
    }

    /// @dev Used to gate new borrows/withdrawals: leaves a buffer below the
    ///      liquidation threshold so a position isn't originated already liquidatable.
    function _isWithinMaxLtv(address user) internal view returns (bool) {
        return _isAboveRatio(user, maxLtvBps);
    }

    /// @dev Used to gate liquidation eligibility: true means the position is still safe.
    function _isAboveLiquidationThreshold(address user) internal view returns (bool) {
        return _isAboveRatio(user, liquidationThresholdBps);
    }

    function _isAboveRatio(address user, uint256 ratioBps) internal view returns (bool) {
        uint256 debt = borrowBalanceOf[user];
        if (debt == 0) return true;

        (int256 price, bool isSafe,) = oracleGuard.getSafePrice(address(collateralToken));
        if (!isSafe) return false;

        uint256 collateralValueUsd = (collateralBalanceOf[user] * uint256(price)) / PRICE_DECIMALS;
        return collateralValueUsd * ratioBps >= debt * BPS;
    }
}
