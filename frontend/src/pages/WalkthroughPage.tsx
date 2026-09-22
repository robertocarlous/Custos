import { useActivityFeed, type ActivityEvent } from "../hooks/useActivityFeed";
import { LiveRunPanel } from "../components/wallet/LiveRunPanel";
import { REFERENCE_TX, robinhoodChainTestnet } from "../config/deployment";

const EXPLORER_BASE = robinhoodChainTestnet.blockExplorers!.default.url;

interface Step {
  title: string;
  body: string;
  eventKind: ActivityEvent["kind"] | null;
}

const STEPS: Step[] = [
  {
    title: "Approve + deposit collateral",
    body: "5 real testnet TSLA approved and deposited as collateral (~$2,000 at the $400 demo price).",
    eventKind: "Deposit",
  },
  {
    title: "Sanity check: liquidate() must revert",
    body: "liquidate() is called against the fresh position before any debt exists, and reverts with PositionIsHealthy() -- proof the checks aren't rubber-stamped.",
    eventKind: null,
  },
  {
    title: "Borrow dUSD",
    body: "1,000 dUSD borrowed at 50% LTV, comfortably under the 70% max LTV.",
    eventKind: "Borrow",
  },
  {
    title: "Crash the price",
    body: "The demo TSLA feed is crashed to $150/share. Collateral value drops to $750 against $1,000 debt -- below the 80% liquidation threshold. getSafePrice still returns isSafe: true (the price itself is fine, only the position is underwater) and isLiquidationAllowed returns true.",
    eventKind: null,
  },
  {
    title: "Liquidate",
    body: "200 dUSD of debt is repaid. Seized 1.4667 TSLA (= 200 × 1.10 / 150, exactly matching the contract's bonus formula), leaving 3.5333 TSLA collateral and 800 dUSD debt.",
    eventKind: "Liquidate",
  },
];

const NAIVE_FAILURES = [
  "Rejects a perfectly valid Friday close every weekend, because the feed hasn't updated in 48+ hours.",
  "Liquidates straight through a corporate-action price pause instead of blocking until it clears.",
  "Trusts a price during an L2 sequencer outage because nothing checked uptime first.",
  "Bots and the contract can disagree on \"safe\", since there's no single source of truth.",
];

const GUARDED_BEHAVIOR = [
  "Calendar-aware thresholds: wide on weekends/holidays, tight on trading days.",
  "Liquidations blocked outright while oraclePaused() is true, regardless of the last price.",
  "Sequencer uptime + restart grace period checked before any price is trusted.",
  "The Risk SDK pre-checks the exact isSafe result the contract itself enforces.",
];

function findEvent(events: ActivityEvent[], kind: ActivityEvent["kind"]): ActivityEvent | undefined {
  return events.find((e) => e.kind === kind);
}

export function WalkthroughPage() {
  const { events, loading, refresh: refreshEvents } = useActivityFeed();

  return (
    <div className="container section--tight">
      <div className="section-heading" style={{ maxWidth: 720 }}>
        <span className="section-kicker">Live liquidation walkthrough</span>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 10 }}>
          A real deposit → borrow → crash → liquidate cycle
        </h1>
        <p>
          Run once against the live <code className="mono">ReferenceLendingPool</code> deployment on{" "}
          {robinhoodChainTestnet.name}, one account acting as both borrower and liquidator. Every step
          below links to its real on-chain transaction where the pool emits one.
        </p>
      </div>

      <div className="timeline" style={{ marginBottom: 56 }}>
        {STEPS.map((step, i) => {
          const matched = step.eventKind ? findEvent(events, step.eventKind) : undefined;
          const isReference = step.eventKind === "Liquidate";
          const txHash = isReference ? REFERENCE_TX.hash : matched?.txHash;

          return (
            <div className="timeline__step" key={step.title}>
              <div className={`timeline__marker${txHash ? " timeline__marker--done" : ""}`}>{i + 1}</div>
              <div className="timeline__card">
                <h4>{step.title}</h4>
                <p>{step.body}</p>
                <div className="timeline__meta">
                  {step.eventKind && (
                    <span className="muted">
                      {loading
                        ? "checking chain…"
                        : matched
                          ? `${step.eventKind} event found on-chain`
                          : "no matching event yet -- rerun the script to generate one"}
                    </span>
                  )}
                  {txHash && (
                    <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer">
                      view transaction →
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-heading">
        <span className="section-kicker">Try it yourself</span>
        <h2>Run it live, from your own wallet</h2>
        <p>
          Deposit, borrow, crash the price, and liquidate against the real pool above -- each button
          submits a real transaction on {robinhoodChainTestnet.name}. You'll need real testnet TSLA
          from the faucet first.
        </p>
      </div>

      <div style={{ marginBottom: 56 }}>
        <LiveRunPanel onActivity={refreshEvents} />
      </div>

      <div className="section-heading">
        <span className="section-kicker">Why it matters</span>
        <h2>Naive vs. guarded</h2>
        <p>The same crash-and-liquidate sequence, with and without OracleGuard in front of it.</p>
      </div>

      <div className="compare" style={{ marginBottom: 48 }}>
        <div className="compare__col compare__col--bad">
          <h4>Without OracleGuard</h4>
          <ul>
            {NAIVE_FAILURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="compare__col compare__col--good">
          <h4>With OracleGuard</h4>
          <ul>
            {GUARDED_BEHAVIOR.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="section-heading">
        <span className="section-kicker">Prefer the CLI?</span>
        <h2>Same sequence, scripted</h2>
        <p>Runs the identical steps non-interactively -- useful for generating a batch of demo transactions.</p>
      </div>

      <pre className="code-block">
        {`RPC_URL=https://rpc.testnet.chain.robinhood.com \\
POOL=0xD3d3229F974BCF1B344f2F3F47D876e5CD139507 \\
GUARD=0x36D03E7a80Ee403c779095c825340c9bf92f2740 \\
FEED=0xF161b46cbF7568ce81e7693BFD8C6b573819586c \\
TOKEN=0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E \\
BORROW_TOKEN=0x2C8dcd15204c0976fA88A788C95C2718FbfA466d \\
PRIVATE_KEY=0x... \\
  ./contracts/script/liquidation-walkthrough.sh`}
      </pre>
    </div>
  );
}
