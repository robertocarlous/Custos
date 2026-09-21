import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { OracleGuardClient } from "./OracleGuardClient.js";
import { GuardReason } from "./types.js";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const GUARD = "0x2222222222222222222222222222222222222222" as const;
const CALENDAR = "0x3333333333333333333333333333333333333333" as const;

function mockClient(readContract: (args: any) => any): PublicClient {
  return { readContract } as unknown as PublicClient;
}

describe("OracleGuardClient", () => {
  it("maps a paused reason to a human-readable label", async () => {
    const readContract = vi.fn().mockResolvedValue([0n, false, GuardReason.ORACLE_PAUSED]);
    const client = new OracleGuardClient(mockClient(readContract), GUARD);

    const result = await client.getSafePrice(TOKEN);

    expect(result.isSafe).toBe(false);
    expect(result.reason).toBe(GuardReason.ORACLE_PAUSED);
    expect(result.reasonLabel).toMatch(/paused/i);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: GUARD, functionName: "getSafePrice", args: [TOKEN] }),
    );
  });

  it("surfaces a safe price on the baseline path", async () => {
    const readContract = vi.fn().mockResolvedValue([15000000000n, true, GuardReason.OK]);
    const client = new OracleGuardClient(mockClient(readContract), GUARD);

    const result = await client.getSafePrice(TOKEN);

    expect(result.isSafe).toBe(true);
    expect(result.price).toBe(15000000000n);
    expect(result.reason).toBe(GuardReason.OK);
  });

  it("preflightLiquidation forwards to isLiquidationAllowedDetailed", async () => {
    const readContract = vi.fn().mockResolvedValue([false, GuardReason.SEQUENCER_DOWN]);
    const client = new OracleGuardClient(mockClient(readContract), GUARD);

    const result = await client.preflightLiquidation(TOKEN);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(GuardReason.SEQUENCER_DOWN);
  });

  it("resolves the calendar registry before checking isMarketOpen", async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(CALENDAR) // calendarRegistry()
      .mockResolvedValueOnce(false); // isMarketOpen()
    const client = new OracleGuardClient(mockClient(readContract), GUARD);

    const open = await client.isMarketOpen(1_800_000_000n);

    expect(open).toBe(false);
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ address: CALENDAR, functionName: "isMarketOpen", args: [1_800_000_000n] }),
    );
  });
});
