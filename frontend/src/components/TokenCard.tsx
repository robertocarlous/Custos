import type { TokenRow } from "../hooks/useSafetyDashboard";
import { StatusBadge } from "./StatusBadge";

function formatPrice(rawPrice: bigint): string {
  // Chainlink-style 8-decimal price.
  const dollars = Number(rawPrice) / 1e8;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatAge(updatedAt: bigint): string {
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(updatedAt));
  if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m ago`;
  if (ageSeconds < 86400) return `${(ageSeconds / 3600).toFixed(1)}h ago`;
  return `${(ageSeconds / 86400).toFixed(1)}d ago`;
}

export function TokenCard({ row }: { row: TokenRow }) {
  const displayPrice = row.price.isSafe ? row.price.price : row.rawFeed?.price;

  return (
    <div className={`card card--${row.status.tone}`}>
      <div className="card__header">
        <div>
          <div className="card__symbol">
            {row.symbol}
            {row.isPoolCollateral && <span className="card__pill">pool collateral</span>}
          </div>
          <div className="card__name">{row.name}</div>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <div className="card__price">
        {displayPrice !== undefined ? formatPrice(displayPrice) : "—"}
        {!row.price.isSafe && (
          <span className="card__price-flag">
            last known{row.rawFeed ? ` · ${formatAge(row.rawFeed.updatedAt)}` : ""}
          </span>
        )}
      </div>

      <div className="card__reason">{row.status.description}</div>

      <div className="card__meta">
        <span>reason: {row.price.reasonLabel}</span>
        <span>isSafe: {String(row.price.isSafe)}</span>
      </div>
    </div>
  );
}
