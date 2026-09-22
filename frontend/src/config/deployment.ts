import { defineChain, type Address } from "viem";

/**
 * Live deployment config for Robinhood Chain testnet. See contracts/README.md
 * ("Live on testnet") for the source of truth — update here if it's redeployed.
 */

export const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Testnet Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
});

export const ORACLE_GUARD_ADDRESS: Address = "0x36D03E7a80Ee403c779095c825340c9bf92f2740";
export const MARKET_CALENDAR_REGISTRY_ADDRESS: Address = "0x85dd33A00c072506Ed6Ec445adB8AB704B64a738";
export const REFERENCE_LENDING_POOL_ADDRESS: Address = "0xD3d3229F974BCF1B344f2F3F47D876e5CD139507";
export const DEMO_BORROW_ASSET_ADDRESS: Address = "0x2C8dcd15204c0976fA88A788C95C2718FbfA466d"; // dUSD

export interface GuardedToken {
  symbol: string;
  name: string;
  address: Address;
  /** true for the token that actually backs the demo ReferenceLendingPool. */
  isPoolCollateral?: boolean;
}

/** Every Stock Token configured on OracleGuard by Deploy.s.sol. */
export const GUARDED_TOKENS: GuardedToken[] = [
  { symbol: "TSLA", name: "Tesla (Stock Token)", address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E", isPoolCollateral: true },
  { symbol: "AMZN", name: "Amazon (Stock Token)", address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02" },
  { symbol: "NFLX", name: "Netflix (Stock Token)", address: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93" },
];

export const REFERENCE_TX = {
  description:
    "Live liquidation walkthrough: deposit TSLA collateral, borrow dUSD, crash the price, liquidate.",
  hash: "0x1bd76375dcb7a37251ddf874f146d18bfe6e2116e720d419b93a544944a6f2a4",
};

/** From Deploy.s.sol -- same for every guarded token. */
export const WEEKDAY_STALENESS_SECONDS = 3600; // 1 hour
export const WEEKEND_STALENESS_SECONDS = 76 * 3600; // 76 hours

/** ReferenceLendingPool risk params (from Deploy.s.sol). */
export const POOL_PARAMS = {
  maxLtvBps: 7000,
  liquidationThresholdBps: 8000,
  liquidationBonusBps: 1000,
};
