import { GuardReason, type SafePriceResult } from "@stock-oracle-guard/sdk";

export type DashboardStatus =
  | "SYNCED"
  | "PAUSED"
  | "STALE-BUT-SAFE"
  | "STALE"
  | "SEQUENCER-DOWN"
  | "UNKNOWN";

export interface StatusInfo {
  status: DashboardStatus;
  label: string;
  description: string;
  tone: "good" | "warn" | "bad";
}

/**
 * Collapses a raw OracleGuard {@link SafePriceResult} plus market-open state into
 * one of the five demo-facing statuses. GuardReason / GUARD_REASON_LABELS already
 * carry the on-chain meaning; this just adds the weekend/holiday distinction that
 * the contract itself doesn't need to make (it's still just "isSafe: true" on-chain).
 */
export function deriveStatus(result: SafePriceResult, marketOpen: boolean): StatusInfo {
  switch (result.reason) {
    case GuardReason.SEQUENCER_DOWN:
    case GuardReason.SEQUENCER_GRACE_PERIOD:
      return {
        status: "SEQUENCER-DOWN",
        label: "Sequencer down",
        description: result.reasonLabel,
        tone: "bad",
      };
    case GuardReason.ORACLE_PAUSED:
      return {
        status: "PAUSED",
        label: "Paused",
        description: result.reasonLabel,
        tone: "bad",
      };
    case GuardReason.STALE_PRICE:
      return {
        status: "STALE",
        label: "Stale",
        description: result.reasonLabel,
        tone: "bad",
      };
    case GuardReason.OK:
      if (result.isSafe && !marketOpen) {
        return {
          status: "STALE-BUT-SAFE",
          label: "Stale but safe",
          description: "Market is closed (weekend/holiday); price age is within the wider off-hours threshold.",
          tone: "warn",
        };
      }
      return {
        status: "SYNCED",
        label: "Synced",
        description: "Fresh price, market open, all guard checks pass.",
        tone: "good",
      };
    case GuardReason.NOT_CONFIGURED:
    case GuardReason.INVALID_PRICE:
    default:
      return {
        status: "UNKNOWN",
        label: "Unknown",
        description: result.reasonLabel,
        tone: "bad",
      };
  }
}
