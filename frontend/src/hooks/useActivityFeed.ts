import { useCallback, useEffect, useState } from "react";
import { formatUnits } from "viem";
import { publicClient } from "../config/client";
import { REFERENCE_LENDING_POOL_ADDRESS } from "../config/deployment";
import { referenceLendingPoolAbi } from "../config/poolAbi";

const EVENT_NAMES = ["Deposit", "Borrow", "Liquidate", "Repay", "Withdraw"] as const;
type EventName = (typeof EVENT_NAMES)[number];

export interface ActivityEvent {
  kind: EventName;
  txHash: string;
  blockNumber: bigint;
  summary: string;
}

const POLL_INTERVAL_MS = 30_000;

function summarize(kind: EventName, args: Record<string, unknown>): string {
  const fmt = (v: unknown) => formatUnits((v as bigint) ?? 0n, 18);
  switch (kind) {
    case "Deposit":
      return `Deposited ${fmt(args.amount)} collateral`;
    case "Withdraw":
      return `Withdrew ${fmt(args.amount)} collateral`;
    case "Borrow":
      return `Borrowed ${fmt(args.amount)} dUSD`;
    case "Repay":
      return `Repaid ${fmt(args.amount)} dUSD`;
    case "Liquidate":
      return `Liquidated ${fmt(args.repayAmount)} dUSD debt, seized ${fmt(args.collateralSeized)} collateral`;
  }
}

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const logsPerEvent = await Promise.all(
        EVENT_NAMES.map((eventName) =>
          publicClient.getContractEvents({
            address: REFERENCE_LENDING_POOL_ADDRESS,
            abi: referenceLendingPoolAbi,
            eventName,
            fromBlock: 0n,
            toBlock: "latest",
          }),
        ),
      );

      const all: ActivityEvent[] = logsPerEvent.flat().map((log) => ({
        kind: log.eventName as EventName,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        summary: summarize(log.eventName as EventName, log.args as Record<string, unknown>),
      }));

      all.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0));
      setEvents(all);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read pool activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { events, loading, error, refresh };
}
