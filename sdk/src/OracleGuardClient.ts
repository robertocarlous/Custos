import type { Address, PublicClient } from "viem";
import { marketCalendarRegistryAbi, oracleGuardAbi } from "./abi.js";
import {
  GUARD_REASON_LABELS,
  GuardReason,
  type LiquidationCheckResult,
  type SafePriceResult,
  type TokenConfig,
} from "./types.js";

/**
 * Thin read-only wrapper around an on-chain OracleGuard deployment.
 *
 * Lets bots/dashboards run the exact same safety checks the contract itself
 * enforces, off-chain and for free, before submitting a transaction that
 * would otherwise revert (e.g. a liquidation attempted while the market is
 * paused or the sequencer is down).
 */
export class OracleGuardClient {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly oracleGuardAddress: Address,
  ) {}

  async getSafePrice(token: Address): Promise<SafePriceResult> {
    const [price, isSafe, reason] = await this.publicClient.readContract({
      address: this.oracleGuardAddress,
      abi: oracleGuardAbi,
      functionName: "getSafePrice",
      args: [token],
    });

    return {
      price,
      isSafe,
      reason: reason as GuardReason,
      reasonLabel: GUARD_REASON_LABELS[reason as GuardReason],
    };
  }

  async isLiquidationAllowed(token: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.oracleGuardAddress,
      abi: oracleGuardAbi,
      functionName: "isLiquidationAllowed",
      args: [token],
    });
  }

  async isLiquidationAllowedDetailed(token: Address): Promise<LiquidationCheckResult> {
    const [allowed, reason] = await this.publicClient.readContract({
      address: this.oracleGuardAddress,
      abi: oracleGuardAbi,
      functionName: "isLiquidationAllowedDetailed",
      args: [token],
    });

    return {
      allowed,
      reason: reason as GuardReason,
      reasonLabel: GUARD_REASON_LABELS[reason as GuardReason],
    };
  }

  async getTokenConfig(token: Address): Promise<TokenConfig> {
    const [priceFeed, weekdayStaleness, weekendStaleness, configured] = await this.publicClient.readContract({
      address: this.oracleGuardAddress,
      abi: oracleGuardAbi,
      functionName: "tokenConfigs",
      args: [token],
    });

    return { priceFeed, weekdayStaleness, weekendStaleness, configured };
  }

  /**
   * Whether the reference market is open at `timestamp` (defaults to now),
   * per the OracleGuard's configured MarketCalendarRegistry.
   */
  async isMarketOpen(timestamp: bigint = BigInt(Math.floor(Date.now() / 1000))): Promise<boolean> {
    const calendarRegistry = await this.publicClient.readContract({
      address: this.oracleGuardAddress,
      abi: oracleGuardAbi,
      functionName: "calendarRegistry",
    });

    return this.publicClient.readContract({
      address: calendarRegistry,
      abi: marketCalendarRegistryAbi,
      functionName: "isMarketOpen",
      args: [timestamp],
    });
  }

  /**
   * Convenience pre-flight check for liquidation bots: returns whether it's
   * worth submitting a `liquidate` transaction at all, so bots can skip the
   * gas cost of a doomed-to-revert call.
   */
  async preflightLiquidation(token: Address): Promise<LiquidationCheckResult> {
    return this.isLiquidationAllowedDetailed(token);
  }
}
