import { ORACLE_GUARD_ADDRESS, robinhoodChainTestnet } from "../config/deployment";

interface DashboardToolbarProps {
  marketOpen: boolean | null;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function DashboardToolbar({ marketOpen, lastUpdated, onRefresh }: DashboardToolbarProps) {
  return (
    <header className="page-header">
      <div>
        <h1>Safety status</h1>
        <p>
          Live guard status for Stock Tokens on <strong>{robinhoodChainTestnet.name}</strong> (chain{" "}
          {robinhoodChainTestnet.id}), read straight off <code className="mono">OracleGuard</code>.
        </p>
      </div>

      <div className="page-header__right">
        <div className="page-header__stat">
          <span className="muted">Market</span>
          <strong className={marketOpen === null ? "" : marketOpen ? "text-good" : "text-warn"}>
            {marketOpen === null ? "…" : marketOpen ? "Open" : "Closed"}
          </strong>
        </div>
        <div className="page-header__stat">
          <span className="muted">OracleGuard</span>
          <a
            className="mono"
            href={`${robinhoodChainTestnet.blockExplorers!.default.url}/address/${ORACLE_GUARD_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            {ORACLE_GUARD_ADDRESS.slice(0, 6)}…{ORACLE_GUARD_ADDRESS.slice(-4)}
          </a>
        </div>
        <button className="button button--secondary button--sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {lastUpdated && (
        <p className="page-header__updated muted">Last updated {lastUpdated.toLocaleTimeString()}</p>
      )}
    </header>
  );
}
