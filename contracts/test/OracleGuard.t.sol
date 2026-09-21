// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {OracleGuard} from "../src/OracleGuard.sol";
import {MarketCalendarRegistry} from "../src/MarketCalendarRegistry.sol";
import {IMarketCalendarRegistry} from "../src/interfaces/IMarketCalendarRegistry.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockBasicStockToken} from "../src/mocks/MockBasicStockToken.sol";

contract OracleGuardTest is Test {
    uint256 constant WEEKDAY_STALENESS = 1 hours;
    uint256 constant WEEKEND_STALENESS = 76 hours;
    uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours;

    OracleGuard guard;
    MarketCalendarRegistry calendarRegistry;
    MockAggregatorV3 priceFeed;
    MockAggregatorV3 sequencerFeed;
    MockStockToken stockToken;

    address owner = address(this);
    uint256 anchorTime = 1_800_000_000; // arbitrary fixed anchor, far past any grace period

    function setUp() public {
        vm.warp(anchorTime);

        priceFeed = new MockAggregatorV3(8, 150e8); // $150.00
        sequencerFeed = new MockAggregatorV3(0, 0); // answer 0 == sequencer up
        sequencerFeed.setStartedAt(anchorTime - 10 days); // well past grace period
        stockToken = new MockStockToken("Apple Stock Token", "AAPLx");
        calendarRegistry = new MarketCalendarRegistry(owner);

        guard = new OracleGuard(address(sequencerFeed), address(calendarRegistry), SEQUENCER_GRACE_PERIOD, owner);
        guard.configureToken(address(stockToken), address(priceFeed), WEEKDAY_STALENESS, WEEKEND_STALENESS);

        // Force the "current" day open by default; individual tests override as needed.
        calendarRegistry.setDayStatus(calendarRegistry.dayId(anchorTime), IMarketCalendarRegistry.DayStatus.Open);
    }

    // ---------------------------------------------------------------------
    // (d) Baseline: everything normal -> behaves like a plain price feed.
    // ---------------------------------------------------------------------
    function test_baseline_returnsSafePrice() public {
        priceFeed.setAnswer(150e8, anchorTime - 5 minutes);

        (int256 price, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertTrue(isSafe);
        assertEq(price, 150e8);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.OK));
        assertTrue(guard.isLiquidationAllowed(address(stockToken)));
    }

    function test_baseline_staleOnOpenMarketIsUnsafe() public {
        // Market is open (set in setUp) but price hasn't updated in 2 hours -- beyond
        // the 1 hour weekday staleness threshold.
        priceFeed.setAnswer(150e8, anchorTime - 2 hours);

        (, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertFalse(isSafe);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.STALE_PRICE));
    }

    // ---------------------------------------------------------------------
    // (a) Weekend: price hasn't updated in 48+ hours but it's a weekend/holiday ->
    //     guard should still return isSafe = true (a naive fixed-cutoff guard would
    //     incorrectly reject this valid Friday close).
    // ---------------------------------------------------------------------
    function test_weekend_staleFridayCloseIsStillSafe() public {
        calendarRegistry.setDayStatus(calendarRegistry.dayId(anchorTime), IMarketCalendarRegistry.DayStatus.Closed);
        priceFeed.setAnswer(150e8, anchorTime - 50 hours); // stale for a weekday, fine for a weekend

        (int256 price, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertTrue(isSafe);
        assertEq(price, 150e8);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.OK));
    }

    function test_weekend_beyondWeekendThresholdIsUnsafe() public {
        calendarRegistry.setDayStatus(calendarRegistry.dayId(anchorTime), IMarketCalendarRegistry.DayStatus.Closed);
        priceFeed.setAnswer(150e8, anchorTime - 100 hours); // stale even for the wider weekend window

        (, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertFalse(isSafe);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.STALE_PRICE));
    }

    // ---------------------------------------------------------------------
    // (b) Paused: oraclePaused() is true -> guard blocks liquidation regardless of price.
    // ---------------------------------------------------------------------
    function test_paused_blocksLiquidationRegardlessOfFreshPrice() public {
        priceFeed.setAnswer(150e8, anchorTime); // perfectly fresh price
        stockToken.setOraclePaused(true);

        (, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertFalse(isSafe);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.ORACLE_PAUSED));
        assertFalse(guard.isLiquidationAllowed(address(stockToken)));
    }

    // ---------------------------------------------------------------------
    // (c) Sequencer down: guard should refuse to return a price.
    // ---------------------------------------------------------------------
    function test_sequencerDown_refusesPrice() public {
        priceFeed.setAnswer(150e8, anchorTime);
        sequencerFeed.setAnswer(1, anchorTime); // answer != 0 means sequencer down

        (, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertFalse(isSafe);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.SEQUENCER_DOWN));
        assertFalse(guard.isLiquidationAllowed(address(stockToken)));
    }

    function test_sequencerGracePeriod_refusesPriceRightAfterRestart() public {
        priceFeed.setAnswer(150e8, anchorTime);
        sequencerFeed.setAnswer(0, anchorTime); // back up...
        sequencerFeed.setStartedAt(anchorTime - 10 minutes); // ...but only 10 min ago, < 1h grace

        (, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(stockToken));

        assertFalse(isSafe);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.SEQUENCER_GRACE_PERIOD));
    }

    function test_revertsForUnconfiguredToken() public {
        MockStockToken other = new MockStockToken("Other", "OTHRx");
        vm.expectRevert(abi.encodeWithSelector(OracleGuard.TokenNotConfigured.selector, address(other)));
        guard.getSafePrice(address(other));
    }

    // ---------------------------------------------------------------------
    // Testnet compatibility: real Robinhood Chain testnet faucet Stock Tokens
    // don't implement oraclePaused() at all (confirmed against a live testnet
    // deployment) -- the guard must degrade gracefully instead of reverting.
    // ---------------------------------------------------------------------
    function test_tokenWithoutOraclePausedIsTreatedAsNotPaused() public {
        MockBasicStockToken basicToken = new MockBasicStockToken("Tesla", "TSLA");
        guard.configureToken(address(basicToken), address(priceFeed), WEEKDAY_STALENESS, WEEKEND_STALENESS);
        priceFeed.setAnswer(150e8, anchorTime - 5 minutes);

        (int256 price, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(address(basicToken));

        assertTrue(isSafe);
        assertEq(price, 150e8);
        assertEq(uint8(reason), uint8(OracleGuard.Reason.OK));
        assertTrue(guard.isLiquidationAllowed(address(basicToken)));
    }

    function test_onlyOwnerCanConfigureToken() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        guard.configureToken(address(stockToken), address(priceFeed), 1 hours, 76 hours);
    }
}
