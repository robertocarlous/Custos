import { useActivityFeed } from "../hooks/useActivityFeed";
import { REFERENCE_TX, robinhoodChainTestnet } from "../config/deployment";

const EXPLORER_BASE = robinhoodChainTestnet.blockExplorers!.default.url;

const KIND_TONE: Record<string, "good" | "warn" | "bad"> = {
  Deposit: "good",
  Borrow: "warn",
  Repay: "good",
  Withdraw: "warn",
  Liquidate: "bad",
};

export function ActivityFeed() {
  const { events, loading, error } = useActivityFeed();

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Pool activity</h2>
        <span className="panel__subtitle">ReferenceLendingPool events, live from chain</span>
      </div>

      {loading && <p className="muted">Loading activity…</p>}
      {error && <p className="error">Couldn't load activity: {error}</p>}

      {!loading && !error && events.length === 0 && (
        <p className="muted">
          No pool activity yet. Rerun{" "}
          <code>contracts/script/liquidation-walkthrough.sh</code> against a fresh account to
          generate live transactions here.
        </p>
      )}

      <ul className="feed">
        {events.map((event) => (
          <li key={event.txHash + event.kind} className="feed__row">
            <span className={`feed__kind feed__kind--${KIND_TONE[event.kind]}`}>{event.kind}</span>
            <span className="feed__summary">{event.summary}</span>
            <a
              className="feed__link"
              href={`${EXPLORER_BASE}/tx/${event.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {event.txHash.slice(0, 10)}…
            </a>
          </li>
        ))}
      </ul>

      <p className="panel__footnote">
        Reference run ({REFERENCE_TX.description}):{" "}
        <a href={`${EXPLORER_BASE}/tx/${REFERENCE_TX.hash}`} target="_blank" rel="noreferrer">
          {REFERENCE_TX.hash.slice(0, 14)}…
        </a>
      </p>
    </section>
  );
}
