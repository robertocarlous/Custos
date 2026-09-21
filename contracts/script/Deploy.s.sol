// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OracleGuard} from "../src/OracleGuard.sol";
import {MarketCalendarRegistry} from "../src/MarketCalendarRegistry.sol";
import {ReferenceLendingPool} from "../src/ReferenceLendingPool.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Deploys MarketCalendarRegistry + OracleGuard (+ a demo ReferenceLendingPool)
///         to Robinhood Chain.
/// @dev Network-specific wiring, mirroring the pattern used by Arbitrum Foundation's own
///      Robinhood Chain example app (github.com/hummusonrails/robinhood-chain-dapp-example):
///
///      robinhood chain testnet (46630)
///        Real faucet Stock Tokens exist (dispensed by faucet.testnet.chain.robinhood.com)
///        but Chainlink has NOT deployed real price feeds or a sequencer uptime feed on
///        testnet -- confirmed both by that reference repo's deploy script comments and by
///        directly probing the feed/token contracts. So this script deploys its own
///        MockAggregatorV3 instances to stand in for both, exactly like the reference app.
///        Testnet faucet tokens also don't implement oraclePaused() (calls revert) --
///        OracleGuard._isOraclePaused() already degrades gracefully for this.
///
///      robinhood chain mainnet (4663)
///        Real Stock Tokens and real Chainlink feeds exist. Pass their addresses via
///        MAINNET_TOKENS / MAINNET_FEEDS / SEQUENCER_UPTIME_FEED env vars -- never
///        hardcode mainnet addresses without verifying them yourself against
///        https://docs.robinhood.com/chain/contracts/ and
///        https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood.
///
///      anything else (e.g. local anvil, 31337)
///        Same mock-everything path as testnet, for local iteration.
contract DeployScript is Script {
    // Real testnet faucet Stock Tokens (chain 46630), dispensed by
    // https://faucet.testnet.chain.robinhood.com. Verified directly against the live
    // testnet RPC on 2026-09-21 (uiMultiplier() succeeds, oraclePaused() reverts --
    // matches the reference app's TESTNET_* constants exactly).
    address internal constant TESTNET_TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;
    address internal constant TESTNET_AMZN = 0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02;
    address internal constant TESTNET_NFLX = 0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93;

    uint256 internal constant WEEKDAY_STALENESS = 1 hours;
    uint256 internal constant WEEKEND_STALENESS = 76 hours;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        uint256 sequencerGracePeriod = vm.envOr("SEQUENCER_GRACE_PERIOD", uint256(1 hours));

        vm.startBroadcast(deployerKey);

        MarketCalendarRegistry calendarRegistry = new MarketCalendarRegistry(deployer);

        address sequencerUptimeFeed = _resolveSequencerFeed();
        OracleGuard guard =
            new OracleGuard(sequencerUptimeFeed, address(calendarRegistry), sequencerGracePeriod, deployer);

        (address demoCollateral, address demoFeed) = _configureTokens(guard);

        MockERC20 borrowAsset = new MockERC20("Demo USD Stable", "dUSD");
        ReferenceLendingPool pool = new ReferenceLendingPool(
            demoCollateral,
            address(borrowAsset),
            address(guard),
            7000, // 70% max LTV
            8000, // 80% liquidation threshold
            1000 // 10% liquidation bonus
        );
        borrowAsset.mint(address(pool), 1_000_000e18);

        vm.stopBroadcast();

        console.log("chain id:", block.chainid);
        console.log("MarketCalendarRegistry:", address(calendarRegistry));
        console.log("OracleGuard:", address(guard));
        console.log("sequencerUptimeFeed:", sequencerUptimeFeed);
        console.log("demo collateral token:", demoCollateral);
        console.log("demo price feed:", demoFeed);
        console.log("demo borrow asset (dUSD):", address(borrowAsset));
        console.log("ReferenceLendingPool:", address(pool));
    }

    function _resolveSequencerFeed() internal returns (address) {
        if (block.chainid == 4663) {
            return vm.envAddress("SEQUENCER_UPTIME_FEED");
        }
        // Chainlink has not deployed a sequencer uptime feed on Robinhood Chain testnet
        // (or local anvil, obviously) -- deploy a mock that always reports "up".
        MockAggregatorV3 mockSequencer = new MockAggregatorV3(0, 0);
        console.log("deployed mock sequencer uptime feed (no real one exists here):", address(mockSequencer));
        return address(mockSequencer);
    }

    /// @dev Configures OracleGuard for every demo token and returns the first
    ///      (token, feed) pair to back the ReferenceLendingPool demo deployment.
    function _configureTokens(OracleGuard guard) internal returns (address firstToken, address firstFeed) {
        if (block.chainid == 4663) {
            address[] memory mainnetTokens = vm.envAddress("MAINNET_TOKENS", ",");
            address[] memory mainnetFeeds = vm.envAddress("MAINNET_FEEDS", ",");
            require(
                mainnetTokens.length == mainnetFeeds.length && mainnetTokens.length > 0,
                "MAINNET_TOKENS/MAINNET_FEEDS mismatch"
            );
            for (uint256 i = 0; i < mainnetTokens.length; i++) {
                guard.configureToken(mainnetTokens[i], mainnetFeeds[i], WEEKDAY_STALENESS, WEEKEND_STALENESS);
            }
            return (mainnetTokens[0], mainnetFeeds[0]);
        }

        // Testnet / local: real faucet-style tickers, mock feeds with plausible demo prices
        // since Chainlink doesn't publish real feeds on testnet.
        address[3] memory tokens = [TESTNET_TSLA, TESTNET_AMZN, TESTNET_NFLX];
        int256[3] memory demoPrices = [int256(400e8), int256(230e8), int256(120e8)];
        string[3] memory labels = ["RHTSLA / USD (mock)", "RHAMZN / USD (mock)", "RHNFLX / USD (mock)"];

        for (uint256 i = 0; i < tokens.length; i++) {
            MockAggregatorV3 feed = new MockAggregatorV3(8, demoPrices[i]);
            guard.configureToken(tokens[i], address(feed), WEEKDAY_STALENESS, WEEKEND_STALENESS);
            console.log(labels[i], address(feed));
            if (i == 0) {
                firstToken = tokens[i];
                firstFeed = address(feed);
            }
        }
    }
}
