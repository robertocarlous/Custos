import { useCallback, useEffect, useRef, useState } from "react";
import type { SafePriceResult } from "@stock-oracle-guard/sdk";
import { oracleGuard, publicClient } from "../config/client";
import { aggregatorV3Abi } from "../config/aggregatorAbi";
import { GUARDED_TOKENS } from "../config/deployment";
import { deriveStatus, type StatusInfo } from "../lib/status";

const POLL_INTERVAL_MS = 20_000;

export interface TokenRow {
  symbol: string;
  name: string;
  address: string;
  isPoolCollateral?: boolean;
  price: SafePriceResult;
  status: StatusInfo;
  /** Raw feed price/age, read directly from the feed -- populated even when the guard flags the price unsafe. */
  rawFeed: { price: bigint; updatedAt: bigint } | null;
}

/**
 * getSafePrice() intentionally zeroes the price whenever isSafe is false (see
 * OracleGuard.sol), so callers can't accidentally act on an unsafe value. For
 * display purposes only, read the raw feed directly so an unsafe card can still
 * show what the last known price was and how stale it is.
 */
async function readRawFeed(token: (typeof GUARDED_TOKENS)[number]): Promise<TokenRow["rawFeed"]> {
  try {
    const config = await oracleGuard.getTokenConfig(token.address);
    const [, answer, , updatedAt] = await publicClient.readContract({
      address: config.priceFeed,
      abi: aggregatorV3Abi,
      functionName: "latestRoundData",
    });
    return { price: answer, updatedAt };
  } catch {
    return null;
  }
}

interface DashboardState {
  rows: TokenRow[];
  marketOpen: boolean | null;
  lastUpdated: Date | null;
  error: string | null;
  loading: boolean;
}

export function useSafetyDashboard() {
  const [state, setState] = useState<DashboardState>({
    rows: [],
    marketOpen: null,
    lastUpdated: null,
    error: null,
    loading: true,
  });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const marketOpen = await oracleGuard.isMarketOpen();
      const prices = await Promise.all(GUARDED_TOKENS.map((token) => oracleGuard.getSafePrice(token.address)));
      const rawFeeds = await Promise.all(
        GUARDED_TOKENS.map((token, i) => (prices[i].isSafe ? null : readRawFeed(token))),
      );

      const rows: TokenRow[] = GUARDED_TOKENS.map((token, i) => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        isPoolCollateral: token.isPoolCollateral,
        price: prices[i],
        status: deriveStatus(prices[i], marketOpen),
        rawFeed: rawFeeds[i],
      }));

      setState({ rows, marketOpen, lastUpdated: new Date(), error: null, loading: false });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to read OracleGuard state",
        loading: false,
      }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...state, refresh, pollIntervalMs: POLL_INTERVAL_MS };
}
