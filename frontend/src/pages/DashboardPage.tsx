import { DashboardToolbar } from "../components/DashboardToolbar";
import { TokenCard } from "../components/TokenCard";
import { ActivityFeed } from "../components/ActivityFeed";
import { useSafetyDashboard } from "../hooks/useSafetyDashboard";

export function DashboardPage() {
  const { rows, marketOpen, lastUpdated, error, loading, refresh } = useSafetyDashboard();

  return (
    <div className="container section--tight">
      <DashboardToolbar marketOpen={marketOpen} lastUpdated={lastUpdated} onRefresh={refresh} />

      {error && <p className="error">Couldn't read OracleGuard: {error}</p>}

      {loading && rows.length === 0 && <p className="muted">Loading safety status…</p>}

      <div className="grid">
        {rows.map((row) => (
          <TokenCard key={row.address} row={row} />
        ))}
      </div>

      <ActivityFeed />
    </div>
  );
}
