import type { TxState } from "../../hooks/useTxRunner";
import { robinhoodChainTestnet } from "../../config/deployment";

const EXPLORER_BASE = robinhoodChainTestnet.blockExplorers!.default.url;

export function TxStatusLine({ state }: { state: TxState }) {
  switch (state.phase) {
    case "idle":
      return null;
    case "pending":
      return <p className="tx-status tx-status--pending">Waiting for wallet confirmation…</p>;
    case "confirming":
      return (
        <p className="tx-status tx-status--pending">
          Confirming{" "}
          <a href={`${EXPLORER_BASE}/tx/${state.hash}`} target="_blank" rel="noreferrer">
            {state.hash.slice(0, 10)}…
          </a>
        </p>
      );
    case "success":
      return (
        <p className="tx-status tx-status--good">
          Confirmed →{" "}
          <a href={`${EXPLORER_BASE}/tx/${state.hash}`} target="_blank" rel="noreferrer">
            {state.hash.slice(0, 10)}…
          </a>
        </p>
      );
    case "error":
      return <p className="tx-status tx-status--bad">{state.message}</p>;
  }
}
