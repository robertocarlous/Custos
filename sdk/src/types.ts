/**
 * Mirrors OracleGuard.Reason on-chain. Order must match the Solidity enum exactly,
 * since the enum is read off-chain as a raw uint8.
 */
export enum GuardReason {
  OK = 0,
  NOT_CONFIGURED = 1,
  SEQUENCER_DOWN = 2,
  SEQUENCER_GRACE_PERIOD = 3,
  ORACLE_PAUSED = 4,
  STALE_PRICE = 5,
  INVALID_PRICE = 6,
}

export const GUARD_REASON_LABELS: Record<GuardReason, string> = {
  [GuardReason.OK]: "OK",
  [GuardReason.NOT_CONFIGURED]: "Token not configured on OracleGuard",
  [GuardReason.SEQUENCER_DOWN]: "L2 sequencer is down",
  [GuardReason.SEQUENCER_GRACE_PERIOD]: "Sequencer restarted recently, still in grace period",
  [GuardReason.ORACLE_PAUSED]: "Stock Token oracle is paused (corporate action)",
  [GuardReason.STALE_PRICE]: "Price feed is stale for the current market session",
  [GuardReason.INVALID_PRICE]: "Price feed returned an invalid (non-positive) price",
};

export interface SafePriceResult {
  /** Raw price, 8 decimals, as returned by the underlying Chainlink feed. */
  price: bigint;
  isSafe: boolean;
  reason: GuardReason;
  reasonLabel: string;
}

export interface LiquidationCheckResult {
  allowed: boolean;
  reason: GuardReason;
  reasonLabel: string;
}

export interface TokenConfig {
  priceFeed: `0x${string}`;
  weekdayStaleness: bigint;
  weekendStaleness: bigint;
  configured: boolean;
}
