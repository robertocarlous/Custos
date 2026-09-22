import { Link } from "react-router-dom";
import { TokenCard } from "../components/TokenCard";
import { useSafetyDashboard } from "../hooks/useSafetyDashboard";
import { GUARDED_TOKENS, robinhoodChainTestnet, WEEKDAY_STALENESS_SECONDS, WEEKEND_STALENESS_SECONDS } from "../config/deployment";

const PROBLEMS = [
  {
    icon: "📅",
    title: "Weekend & holiday staleness",
    body: "Stock Tokens trade 24/7 but Chainlink feeds only update 24/5. A naive staleness check rejects a perfectly valid Friday close every single weekend.",
  },
  {
    icon: "⏸️",
    title: "Oracle-paused corporate actions",
    body: "Mainnet Stock Tokens can flag oraclePaused() during splits or dividends. Ignore it and you liquidate against a price that's about to be corrected.",
  },
  {
    icon: "🔌",
    title: "Sequencer downtime",
    body: "An L2 sequencer outage can make stale data look fresh. Every price read needs to check sequencer uptime and its restart grace period first.",
  },
];

const FLOW_STEPS = [
  {
    title: "Chainlink feed + Stock Token",
    body: "Raw price answer, oraclePaused() flag, and sequencer uptime feed -- the untrusted inputs.",
  },
  {
    title: "OracleGuard.sol",
    body: "Calendar-aware staleness, pause check, sequencer check. Returns (price, isSafe, reason) -- never reverts on an unsafe read.",
  },
  {
    title: "ReferenceLendingPool + Risk SDK",
    body: "On-chain borrows/liquidations gate on isSafe. Off-chain bots pre-check the same result before spending gas.",
  },
  {
    title: "This dashboard",
    body: "Reads the exact same guard state live, no separate source of truth.",
  },
];

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  return h % 24 === 0 && h >= 24 ? `${h / 24}d` : `${h}h`;
}

export function LandingPage() {
  const { rows } = useSafetyDashboard();

  return (
    <div>
      <section className="hero">
        <div className="container">
          <span className="hero__badge">
            <span className="badge__dot" style={{ color: "var(--good)" }} />
            Live on {robinhoodChainTestnet.name}
          </span>
          <h1>
            Correct oracle safety for <span className="gradient">24/7 Stock Tokens</span>, without
            re-solving it yourself
          </h1>
          <p className="lead">
            OracleGuard is a reusable on-chain safety layer for Chainlink price feeds on Robinhood
            Chain Stock Tokens: calendar-aware staleness, oracle-pause handling, and sequencer-uptime
            checks -- built once, imported by any lending or perps protocol.
          </p>
          <div className="hero__actions">
            <Link to="/dashboard" className="button button--primary">
              View live dashboard →
            </Link>
            <Link to="/walkthrough" className="button button--secondary">
              See a real liquidation
            </Link>
          </div>

          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value">{GUARDED_TOKENS.length}</div>
              <div className="hero__stat-label">Stock Tokens guarded</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{formatHours(WEEKDAY_STALENESS_SECONDS)}</div>
              <div className="hero__stat-label">Weekday staleness window</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{formatHours(WEEKEND_STALENESS_SECONDS)}</div>
              <div className="hero__stat-label">Weekend staleness window</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{robinhoodChainTestnet.id}</div>
              <div className="hero__stat-label">Chain ID (testnet)</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <div className="section-heading">
            <span className="section-kicker">The gap</span>
            <h2>Three ways a naive integration gets liquidations wrong</h2>
            <p>
              Robinhood + Chainlink solve the token side on mainnet. What's missing is the reusable
              piece that consumes it correctly.
            </p>
          </div>
          <div className="feature-grid">
            {PROBLEMS.map((p) => (
              <div className="feature-card" key={p.title}>
                <div className="feature-card__icon">{p.icon}</div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <div className="section-heading">
            <span className="section-kicker">How it works</span>
            <h2>One guard, checked the same way on-chain and off</h2>
            <p>Every consumer -- the pool, the SDK, this dashboard -- reads the exact same result.</p>
          </div>
          <div className="flow">
            {FLOW_STEPS.map((step, i) => (
              <div className="flow__step" key={step.title}>
                <div className="flow__index">{String(i + 1).padStart(2, "0")}</div>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", maxWidth: "none" }}>
            <div>
              <span className="section-kicker">Live right now</span>
              <h2>Not a mockup -- this is reading the deployed contracts</h2>
            </div>
            <Link to="/dashboard" className="button button--ghost button--sm">
              Full dashboard →
            </Link>
          </div>
          <div className="grid grid--compact">
            {rows.length === 0 && <p className="muted">Loading live status…</p>}
            {rows.map((row) => (
              <TokenCard key={row.address} row={row} />
            ))}
          </div>
        </div>
      </section>

      <section className="section--tight">
        <div className="container">
          <div className="cta-band">
            <div>
              <h3>Watch a real liquidation, gated correctly</h3>
              <p>
                Deposit collateral, borrow, crash the price, liquidate -- with the exact transaction
                hashes from a live run on testnet.
              </p>
            </div>
            <div className="cta-band__actions">
              <Link to="/walkthrough" className="button button--primary">
                Open the walkthrough
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
