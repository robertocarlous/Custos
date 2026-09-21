// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IStockToken} from "./interfaces/IStockToken.sol";
import {IMarketCalendarRegistry} from "./interfaces/IMarketCalendarRegistry.sol";

/// @title OracleGuard
/// @notice Reusable safety layer for consuming Chainlink price feeds on Stock Tokens
///         that trade 24/7 while their feeds only update 24/5. Any lending/perps
///         protocol on Robinhood Chain can import this contract to get correct
///         staleness handling, oracle-pause handling, and sequencer-uptime checks
///         without re-solving them from scratch.
/// @dev Guarantees enforced by getSafePrice():
///        1. The L2 sequencer must be up, and past its grace period after a restart.
///        2. The Stock Token's oraclePaused() flag must be false.
///        3. The price feed must not be stale, where "stale" is calendar-aware:
///           a wider staleness threshold applies when the reference market is
///           closed (weekend/holiday) so a valid Friday close isn't rejected,
///           and the normal tight threshold applies while the market is open.
contract OracleGuard is Ownable {
    enum Reason {
        OK,
        NOT_CONFIGURED,
        SEQUENCER_DOWN,
        SEQUENCER_GRACE_PERIOD,
        ORACLE_PAUSED,
        STALE_PRICE,
        INVALID_PRICE
    }

    struct TokenConfig {
        address priceFeed;
        uint256 weekdayStaleness; // max age (seconds) accepted while market is open
        uint256 weekendStaleness; // max age (seconds) accepted while market is closed
        bool configured;
    }

    /// @notice Chainlink L2 sequencer uptime feed (answer == 0 means "up").
    address public immutable sequencerUptimeFeed;

    IMarketCalendarRegistry public calendarRegistry;
    uint256 public sequencerGracePeriod;

    mapping(address => TokenConfig) public tokenConfigs;

    event TokenConfigured(
        address indexed token, address indexed priceFeed, uint256 weekdayStaleness, uint256 weekendStaleness
    );
    event TokenRemoved(address indexed token);
    event CalendarRegistryUpdated(address indexed registry);
    event SequencerGracePeriodUpdated(uint256 period);

    error ZeroAddress();
    error TokenNotConfigured(address token);

    constructor(address _sequencerUptimeFeed, address _calendarRegistry, uint256 _sequencerGracePeriod, address _owner)
        Ownable(_owner)
    {
        if (_sequencerUptimeFeed == address(0) || _calendarRegistry == address(0)) revert ZeroAddress();
        sequencerUptimeFeed = _sequencerUptimeFeed;
        calendarRegistry = IMarketCalendarRegistry(_calendarRegistry);
        sequencerGracePeriod = _sequencerGracePeriod;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function configureToken(address token, address priceFeed, uint256 weekdayStaleness, uint256 weekendStaleness)
        external
        onlyOwner
    {
        if (token == address(0) || priceFeed == address(0)) revert ZeroAddress();
        tokenConfigs[token] = TokenConfig({
            priceFeed: priceFeed,
            weekdayStaleness: weekdayStaleness,
            weekendStaleness: weekendStaleness,
            configured: true
        });
        emit TokenConfigured(token, priceFeed, weekdayStaleness, weekendStaleness);
    }

    function removeToken(address token) external onlyOwner {
        delete tokenConfigs[token];
        emit TokenRemoved(token);
    }

    function setCalendarRegistry(address _calendarRegistry) external onlyOwner {
        if (_calendarRegistry == address(0)) revert ZeroAddress();
        calendarRegistry = IMarketCalendarRegistry(_calendarRegistry);
        emit CalendarRegistryUpdated(_calendarRegistry);
    }

    function setSequencerGracePeriod(uint256 period) external onlyOwner {
        sequencerGracePeriod = period;
        emit SequencerGracePeriodUpdated(period);
    }

    // ---------------------------------------------------------------------
    // Views consumed by protocols
    // ---------------------------------------------------------------------

    /// @notice Returns a safe-to-use price for `token`, or isSafe = false with a reason.
    /// @dev Never reverts on an unsafe condition (sequencer down, paused, stale) so
    ///      callers can branch on `isSafe` instead of wrapping every call in try/catch.
    ///      Reverts only if `token` was never configured, since that is caller error.
    function getSafePrice(address token) public view returns (int256 price, bool isSafe, Reason reason) {
        TokenConfig memory cfg = tokenConfigs[token];
        if (!cfg.configured) revert TokenNotConfigured(token);

        (bool sequencerOk, Reason sequencerReason) = _checkSequencer();
        if (!sequencerOk) {
            return (0, false, sequencerReason);
        }

        if (_isOraclePaused(token)) {
            return (0, false, Reason.ORACLE_PAUSED);
        }

        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(cfg.priceFeed).latestRoundData();
        if (answer <= 0) {
            return (0, false, Reason.INVALID_PRICE);
        }

        bool marketOpen = calendarRegistry.isMarketOpen(block.timestamp);
        uint256 threshold = marketOpen ? cfg.weekdayStaleness : cfg.weekendStaleness;
        if (block.timestamp - updatedAt > threshold) {
            return (0, false, Reason.STALE_PRICE);
        }

        return (answer, true, Reason.OK);
    }

    /// @notice Whether a liquidation against `token` collateral/debt may proceed right now.
    /// @dev Liquidations are blocked whenever getSafePrice() is not safe -- in particular
    ///      while oraclePaused() is true, regardless of what the last-known price was.
    function isLiquidationAllowed(address token) external view returns (bool allowed) {
        (, bool isSafe,) = getSafePrice(token);
        return isSafe;
    }

    /// @notice Same as isLiquidationAllowed but also surfaces the reason for dashboards/bots.
    function isLiquidationAllowedDetailed(address token) external view returns (bool allowed, Reason reason) {
        (, bool isSafe, Reason r) = getSafePrice(token);
        return (isSafe, r);
    }

    /// @dev Some Stock Token deployments (observed on Robinhood Chain testnet faucet
    ///      tokens) don't implement oraclePaused() at all and simply revert -- only
    ///      mainnet tokens are confirmed to support it. Treat "unsupported" as
    ///      "not paused" rather than bricking every price read on those deployments;
    ///      a token that can't signal a pause can't be blocked on one.
    function _isOraclePaused(address token) internal view returns (bool paused) {
        try IStockToken(token).oraclePaused() returns (bool p) {
            return p;
        } catch {
            return false;
        }
    }

    function _checkSequencer() internal view returns (bool ok, Reason reason) {
        (, int256 sequencerAnswer, uint256 startedAt,,) = AggregatorV3Interface(sequencerUptimeFeed).latestRoundData();
        bool sequencerUp = sequencerAnswer == 0;
        if (!sequencerUp) {
            return (false, Reason.SEQUENCER_DOWN);
        }
        if (block.timestamp - startedAt < sequencerGracePeriod) {
            return (false, Reason.SEQUENCER_GRACE_PERIOD);
        }
        return (true, Reason.OK);
    }
}
