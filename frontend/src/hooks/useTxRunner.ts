import { useCallback, useState } from "react";
import type { Hash } from "viem";
import { publicClient } from "../config/client";
import { describeError } from "../lib/tx";

export type TxState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "confirming"; hash: Hash }
  | { phase: "success"; hash: Hash }
  | { phase: "error"; message: string };

export function useTxRunner(onSuccess?: () => void) {
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(
    async (fn: () => Promise<Hash>) => {
      setState({ phase: "pending" });
      try {
        const hash = await fn();
        setState({ phase: "confirming", hash });
        await publicClient.waitForTransactionReceipt({ hash });
        setState({ phase: "success", hash });
        onSuccess?.();
      } catch (err) {
        setState({ phase: "error", message: describeError(err) });
      }
    },
    [onSuccess],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, run, reset, busy: state.phase === "pending" || state.phase === "confirming" };
}
