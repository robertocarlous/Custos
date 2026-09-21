// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {OracleGuard} from "../../src/OracleGuard.sol";
import {MarketCalendarRegistry} from "../../src/MarketCalendarRegistry.sol";
import {AggregatorV3Interface} from "../../src/interfaces/AggregatorV3Interface.sol";
import {IStockToken} from "../../src/interfaces/IStockToken.sol";
import {MockAggregatorV3} from "../../src/mocks/MockAggregatorV3.sol";

// Fork tests against Robinhood Chain MAINNET (chain 4663) -- the only place real
// Chainlink price feeds and oraclePaused()-supporting Stock Tokens exist. Testnet
// (see OracleGuard.t.sol / ReferenceLendingPool.t.sol) only has faucet tokens that
// don't implement oraclePaused() at all, so this fork test is the only way to prove
// OracleGuard's pause check works against the real interface.
//
// Addresses cross-checked two ways: directly via `cast call` against
// https://rpc.mainnet.chain.robinhood.com, and against Arbitrum Foundation's own
// Robinhood Chain example (github.com/hummusonrails/robinhood-chain-dapp-example,
// contracts/script/Deploy.s.sol and contracts/test/fork/BasketMainnetFork.t.sol),
// which hardcodes the same addresses.
//
// No Chainlink L2 sequencer uptime feed exists for Robinhood Chain on any network --
// confirmed against https://docs.chain.link/data-feeds/l2-sequencer-feeds, which
// lists supported networks and Robinhood isn't among them. So this test mocks only
// the sequencer feed (already fully covered by mocks in OracleGuard.t.sol) and uses
// real data for everything else: the real Chainlink price feed and the real
// Stock Token's oraclePaused()/uiMultiplier() interface.
//
// Run with: forge test --match-path "test/fork/*" --fork-url https://rpc.mainnet.chain.robinhood.com -vv
// (excluded from the default `forge test` run so the fast local suite needs no network.)
contract OracleGuardMainnetForkTest is Test {
    address internal constant MAINNET_TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address internal constant MAINNET_TSLA_FEED = 0x4A1166a659A55625345e9515b32adECea5547C38;

    // Stock feeds update 24/5; generous bands since the real mainnet heartbeat isn't
    // publicly documented -- pick a threshold wide enough not to flake on a live fork,
    // narrow enough to still be a meaningful staleness check.
    uint256 internal constant WEEKDAY_STALENESS = 26 hours;
    uint256 internal constant WEEKEND_STALENESS = 96 hours;

    OracleGuard internal guard;
    MarketCalendarRegistry internal calendarRegistry;
    address internal owner = address(this);

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_MAINNET_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com"));
        vm.createSelectFork(rpc);
        assertEq(block.chainid, 4663);

        // No real sequencer uptime feed exists for Robinhood Chain (mainnet or
        // testnet) -- mock just this piece, matching the pattern used elsewhere
        // in this repo and in the reference app's own testnet deploy script.
        MockAggregatorV3 sequencerFeed = new MockAggregatorV3(0, 0);
        sequencerFeed.setStartedAt(block.timestamp - 10 days);

        calendarRegistry = new MarketCalendarRegistry(owner);
        guard = new OracleGuard(address(sequencerFeed), address(calendarRegistry), 1 hours, owner);
        guard.configureToken(MAINNET_TSLA, MAINNET_TSLA_FEED, WEEKDAY_STALENESS, WEEKEND_STALENESS);
    }

    function test_realStockTokenExposesOraclePausedAndUiMultiplier() public view {
        // The single assertion testnet can never make: real mainnet Stock Tokens
        // actually implement oraclePaused(), unlike testnet faucet tokens.
        bool paused = IStockToken(MAINNET_TSLA).oraclePaused();
        assertFalse(paused, "did not expect TSLA to be paused during a routine test run");
    }

    function test_realFeedIsALiveUsdFeed() public view {
        assertEq(AggregatorV3Interface(MAINNET_TSLA_FEED).decimals(), 8);
        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(MAINNET_TSLA_FEED).latestRoundData();
        assertGt(answer, 0);
        assertGt(updatedAt, 0);
        // sanity band: a single share of a large-cap stock is worth $10-$10,000
        assertGt(answer, 10e8);
        assertLt(answer, 10_000e8);
    }

    /// @dev End-to-end: OracleGuard against a REAL Chainlink feed and a REAL
    ///      Stock Token, with only the (nonexistent) sequencer feed mocked.
    ///      Whichever branch executes, it proves the full pipeline is wired
    ///      correctly against genuine mainnet infrastructure, not just mocks.
    function test_getSafePrice_endToEnd_againstRealMainnetInfra() public view {
        (int256 guardPrice, bool isSafe, OracleGuard.Reason reason) = guard.getSafePrice(MAINNET_TSLA);
        (, int256 rawAnswer,,,) = AggregatorV3Interface(MAINNET_TSLA_FEED).latestRoundData();

        if (isSafe) {
            assertEq(uint8(reason), uint8(OracleGuard.Reason.OK));
            assertEq(guardPrice, rawAnswer);
        } else {
            // sequencer is freshly mocked "up" and TSLA isn't paused (asserted above),
            // so the only way this fork test's snapshot could be unsafe is staleness.
            assertEq(uint8(reason), uint8(OracleGuard.Reason.STALE_PRICE));
        }
    }

    function test_isLiquidationAllowed_matchesGetSafePrice() public view {
        (, bool isSafe,) = guard.getSafePrice(MAINNET_TSLA);
        assertEq(guard.isLiquidationAllowed(MAINNET_TSLA), isSafe);
    }
}
