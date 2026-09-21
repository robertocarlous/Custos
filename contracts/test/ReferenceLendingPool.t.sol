// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {OracleGuard} from "../src/OracleGuard.sol";
import {ReferenceLendingPool} from "../src/ReferenceLendingPool.sol";
import {MarketCalendarRegistry} from "../src/MarketCalendarRegistry.sol";
import {IMarketCalendarRegistry} from "../src/interfaces/IMarketCalendarRegistry.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract ReferenceLendingPoolTest is Test {
    uint256 constant WEEKDAY_STALENESS = 1 hours;
    uint256 constant WEEKEND_STALENESS = 76 hours;

    OracleGuard guard;
    MarketCalendarRegistry calendarRegistry;
    MockAggregatorV3 priceFeed;
    MockAggregatorV3 sequencerFeed;
    MockStockToken stockToken;
    MockERC20 stable;
    ReferenceLendingPool pool;

    address owner = address(this);
    address alice = address(0xA11CE);
    address liquidator = address(0x1111);
    uint256 anchorTime = 1_800_000_000;

    function setUp() public {
        vm.warp(anchorTime);

        priceFeed = new MockAggregatorV3(8, 150e8);
        sequencerFeed = new MockAggregatorV3(0, 0);
        sequencerFeed.setStartedAt(anchorTime - 10 days);
        stockToken = new MockStockToken("Apple Stock Token", "AAPLx");
        stable = new MockERC20("USD Stable", "USDs");
        calendarRegistry = new MarketCalendarRegistry(owner);
        calendarRegistry.setDayStatus(calendarRegistry.dayId(anchorTime), IMarketCalendarRegistry.DayStatus.Open);

        guard = new OracleGuard(address(sequencerFeed), address(calendarRegistry), 1 hours, owner);
        guard.configureToken(address(stockToken), address(priceFeed), WEEKDAY_STALENESS, WEEKEND_STALENESS);

        // 70% max LTV, 80% liquidation threshold, 10% liquidation bonus.
        pool = new ReferenceLendingPool(address(stockToken), address(stable), address(guard), 7000, 8000, 1000);

        stable.mint(address(pool), 1_000_000e18);
        stockToken.mint(alice, 100e18);
        stable.mint(liquidator, 1_000_000e18);

        vm.prank(alice);
        stockToken.approve(address(pool), type(uint256).max);
        vm.prank(liquidator);
        stable.approve(address(pool), type(uint256).max);
    }

    function test_depositAndBorrowWithinLtv() public {
        vm.startPrank(alice);
        pool.depositCollateral(10e18); // 10 shares * $150 = $1500 collateral
        pool.borrow(1000e18); // $1000 debt, LTV ~66.7% < 70% max
        vm.stopPrank();

        assertEq(pool.borrowBalanceOf(alice), 1000e18);
        assertTrue(pool.isHealthy(alice));
    }

    function test_borrowRevertsAboveMaxLtv() public {
        vm.startPrank(alice);
        pool.depositCollateral(10e18); // $1500 collateral
        vm.expectRevert(ReferenceLendingPool.PositionWouldBeUnhealthy.selector);
        pool.borrow(1100e18); // ~73% LTV > 70% max
        vm.stopPrank();
    }

    function test_borrowRevertsWhenOraclePaused() public {
        vm.prank(alice);
        pool.depositCollateral(10e18);

        stockToken.setOraclePaused(true);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ReferenceLendingPool.OraclePriceUnsafe.selector, OracleGuard.Reason.ORACLE_PAUSED)
        );
        pool.borrow(100e18);
    }

    function test_liquidationBlockedWhilePaused_evenIfPositionUnderwater() public {
        vm.startPrank(alice);
        pool.depositCollateral(10e18); // $1500
        pool.borrow(1000e18); // 66.7% LTV, healthy at 80% threshold
        vm.stopPrank();

        // Price crashes: collateral now worth $1000 * ... let's drop price so debt > threshold.
        priceFeed.setAnswer(90e8, anchorTime); // 10 shares * $90 = $900 < $1000/0.8=$1250 required
        assertFalse(pool.isHealthy(alice));

        // But the oracle is paused (e.g. corporate action) -- liquidation must be blocked.
        stockToken.setOraclePaused(true);

        vm.prank(liquidator);
        vm.expectRevert(
            abi.encodeWithSelector(ReferenceLendingPool.LiquidationNotAllowed.selector, OracleGuard.Reason.ORACLE_PAUSED)
        );
        pool.liquidate(alice, 100e18);
    }

    function test_liquidationSucceedsWhenUnderwaterAndOracleSafe() public {
        vm.startPrank(alice);
        pool.depositCollateral(10e18); // $1500
        pool.borrow(1000e18);
        vm.stopPrank();

        priceFeed.setAnswer(90e8, anchorTime); // now underwater
        assertFalse(pool.isHealthy(alice));

        uint256 liquidatorCollateralBefore = stockToken.balanceOf(liquidator);

        vm.prank(liquidator);
        pool.liquidate(alice, 100e18);

        assertEq(pool.borrowBalanceOf(alice), 900e18);
        uint256 seized = stockToken.balanceOf(liquidator) - liquidatorCollateralBefore;
        // repay $100 at $90/share with 10% bonus = 100 * 1.10 / 90 shares
        uint256 repayAmount = 100e18;
        uint256 sharePrice = 90e8;
        uint256 expectedSeized = (repayAmount * 1e8 * 11000) / (sharePrice * 10000);
        assertEq(seized, expectedSeized);
    }

    function test_liquidationRevertsWhenPositionHealthy() public {
        vm.startPrank(alice);
        pool.depositCollateral(10e18);
        pool.borrow(1000e18);
        vm.stopPrank();

        vm.prank(liquidator);
        vm.expectRevert(ReferenceLendingPool.PositionIsHealthy.selector);
        pool.liquidate(alice, 100e18);
    }

    function test_liquidationBlockedWhenSequencerDown() public {
        vm.startPrank(alice);
        pool.depositCollateral(10e18);
        pool.borrow(1000e18);
        vm.stopPrank();

        priceFeed.setAnswer(90e8, anchorTime);
        sequencerFeed.setAnswer(1, anchorTime);

        vm.prank(liquidator);
        vm.expectRevert(
            abi.encodeWithSelector(ReferenceLendingPool.LiquidationNotAllowed.selector, OracleGuard.Reason.SEQUENCER_DOWN)
        );
        pool.liquidate(alice, 100e18);
    }
}
