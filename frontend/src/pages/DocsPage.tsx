import { GuardReason, GUARD_REASON_LABELS } from "@stock-oracle-guard/sdk";
import { Link } from "react-router-dom";
import { DocsSidebar } from "../components/docs/DocsSidebar";
import { CodeBlock } from "../components/docs/CodeBlock";
import { PackageManagerTabs } from "../components/docs/PackageManagerTabs";
import { ApiMethod } from "../components/docs/ApiMethod";
import { GUARDED_TOKENS, ORACLE_GUARD_ADDRESS, robinhoodChainTestnet } from "../config/deployment";

const TSLA = GUARDED_TOKENS.find((t) => t.isPoolCollateral)!.address;

const REASON_ROWS = Object.entries(GuardReason)
  .filter(([key]) => Number.isNaN(Number(key)))
  .map(([name, value]) => ({
    name,
    value: value as GuardReason,
    label: GUARD_REASON_LABELS[value as GuardReason],
  }));

const QUICKSTART_CODE = `import { createPublicClient, http, defineChain } from "viem";
import { OracleGuardClient } from "@stock-oracle-guard/sdk";

const robinhoodChainTestnet = defineChain({
  id: ${robinhoodChainTestnet.id},
  name: "${robinhoodChainTestnet.name}",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["${robinhoodChainTestnet.rpcUrls.default.http[0]}"] } },
});

const publicClient = createPublicClient({
  chain: robinhoodChainTestnet,
  transport: http(),
});

const guard = new OracleGuardClient(publicClient, "${ORACLE_GUARD_ADDRESS}");

const result = await guard.getSafePrice("${TSLA}"); // real testnet TSLA
console.log(result);
// { price: 40000000000n, isSafe: true, reason: 0, reasonLabel: "OK" }`;

const CHAIN_FILE_CODE = `import { defineChain } from "viem";

export const robinhoodChainTestnet = defineChain({
  id: ${robinhoodChainTestnet.id},
  name: "${robinhoodChainTestnet.name}",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["${robinhoodChainTestnet.rpcUrls.default.http[0]}"] } },
});

// Swap for your own deployment if you're not using the addresses this
// repo documents in contracts/README.md ("Live on testnet").
export const ORACLE_GUARD_ADDRESS = "${ORACLE_GUARD_ADDRESS}";`;

const CLIENT_FILE_CODE = `import { createPublicClient, http } from "viem";
import { OracleGuardClient } from "@stock-oracle-guard/sdk";
import { robinhoodChainTestnet, ORACLE_GUARD_ADDRESS } from "./chain";

const publicClient = createPublicClient({
  chain: robinhoodChainTestnet,
  transport: http(),
});

// One client, one RPC connection -- import \`guard\` anywhere you need a
// safety check instead of constructing a new one per call site.
export const guard = new OracleGuardClient(publicClient, ORACLE_GUARD_ADDRESS);`;

const USAGE_FILE_CODE = `import { guard } from "./lib/oracleGuard";

const { isSafe, reasonLabel } = await guard.getSafePrice(tokenAddress);
if (!isSafe) {
  console.log(\`Skipping: \${reasonLabel}\`);
}`;

const FROM_SOURCE_CODE = `git clone https://github.com/robertocarlous/Custos.git
cd Custos
npm install
npm run build --workspace=sdk

# then, from your own project:
npm install file:../Custos/sdk`;

export function DocsPage() {
  return (
    <div className="container section--tight docs-shell">
      <DocsSidebar />

      <div className="docs-content">
        <span className="section-kicker">SDK documentation</span>
        <h1 id="overview" style={{ fontSize: "2rem", marginBottom: 10, scrollMarginTop: 90 }}>
          Risk SDK
        </h1>
        <div className="docs-badges">
          <span className="card__pill mono">@stock-oracle-guard/sdk</span>
          <span className="card__pill">MIT licensed</span>
          <span className="card__pill">viem peer dependency</span>
        </div>
        <p className="docs-lead">
          A thin, read-only <a href="https://viem.sh" target="_blank" rel="noreferrer">viem</a>-based wrapper
          around a deployed <code className="mono">OracleGuard</code> contract. It lets bots and dashboards
          run the exact same safety checks the contract itself enforces -- off-chain and for free -- before
          submitting a transaction that would otherwise revert. This dashboard is itself built entirely on
          this SDK; every page you've seen so far is a consumer of the API documented below.
        </p>

        <h2 id="prerequisites">Prerequisites</h2>
        <ul>
          <li>Node.js 18 or later</li>
          <li>
            A <code className="mono">viem</code> <code className="mono">PublicClient</code> (any RPC transport
            works -- HTTP is enough for reads)
          </li>
          <li>No wallet, private key, or gas needed -- every method in this SDK is a read-only contract call</li>
        </ul>

        <h2 id="installation">Installation</h2>
        <p>
          <code className="mono">viem</code> is a peer dependency, so it's installed alongside the SDK if you
          don't already have it.
        </p>
        <PackageManagerTabs pkg="@stock-oracle-guard/sdk viem" />
        <div className="callout" style={{ marginTop: 4 }}>
          Not yet published to the npm registry. Until then, install it straight from source:
          <div style={{ marginTop: 10 }}>
            <CodeBlock code={FROM_SOURCE_CODE} />
          </div>
        </div>

        <h2 id="quickstart">Quickstart</h2>
        <p>
          Point a <code className="mono">PublicClient</code> at {robinhoodChainTestnet.name} and ask
          <code className="mono">OracleGuard</code> for a safe price. This exact snippet is runnable as-is --
          it uses the live deployed address and a real testnet Stock Token.
        </p>
        <CodeBlock label="check-price.ts -- a standalone script, not part of any project yet" code={QUICKSTART_CODE} />
        <p>
          Save that as <code className="mono">check-price.ts</code> anywhere and run it directly -- no
          project scaffolding needed yet, this is just to confirm the SDK can reach the chain:
        </p>
        <CodeBlock code={`npx tsx check-price.ts`} />
        <p>
          Prefer to see it already wired up end-to-end?{" "}
          <code className="mono">sdk/examples/live-testnet-check.ts</code> in the repo runs this same call
          plus <code className="mono">preflightLiquidation</code>, <code className="mono">isMarketOpen</code>,
          and <code className="mono">getTokenConfig</code> -- run it with{" "}
          <code className="mono">npm run example:live-testnet</code> from <code className="mono">sdk/</code>.
        </p>

        <h2 id="project-setup">Project setup</h2>
        <p>
          The quickstart above is a single throwaway file. For a real app, split it into a config module
          you import from everywhere, so the client and addresses are defined exactly once. This is the
          layout to add inside your own project (Node backend, bot, or frontend -- the pattern is the same):
        </p>
        <pre className="code-block">{`your-project/
├── src/
│   ├── lib/
│   │   ├── chain.ts         # chain + contract address constants
│   │   └── oracleGuard.ts   # the shared client -- import { guard } from here
│   └── ...                  # your app code
└── package.json`}</pre>

        <p>
          <code className="mono">src/lib/chain.ts</code>
        </p>
        <CodeBlock code={CHAIN_FILE_CODE} />

        <p>
          <code className="mono">src/lib/oracleGuard.ts</code>
        </p>
        <CodeBlock code={CLIENT_FILE_CODE} />

        <p>Then, anywhere else in your app:</p>
        <CodeBlock code={USAGE_FILE_CODE} />

        <div className="callout">
          This is exactly the pattern this repo's own frontend uses -- not a hypothetical. See{" "}
          <code className="mono">frontend/src/config/deployment.ts</code> (the{" "}
          <code className="mono">chain.ts</code> role above) and{" "}
          <code className="mono">frontend/src/config/client.ts</code> (the{" "}
          <code className="mono">oracleGuard.ts</code> role), then grep the codebase for{" "}
          <code className="mono">from "../config/client"</code> -- every page and hook that needs a safety
          check imports that one shared instance, including <Link to="/dashboard">the dashboard</Link> and{" "}
          <Link to="/walkthrough">the walkthrough page</Link> you can already see running.
        </div>

        <h2 id="understanding-the-result">Understanding the result</h2>
        <p>
          Every price-reading method returns the same three-part shape: a raw <code className="mono">price</code>{" "}
          (8 decimals, Chainlink-style), an <code className="mono">isSafe</code> boolean, and a{" "}
          <code className="mono">reason</code>. Branch on <code className="mono">isSafe</code> --{" "}
          <code className="mono">getSafePrice</code> never reverts or throws for an unsafe condition, so you
          never need a try/catch just to check whether a price is usable.
        </p>
        <div className="callout">
          When <code className="mono">isSafe</code> is <code className="mono">false</code>, the contract
          intentionally zeroes <code className="mono">price</code> to <code className="mono">0n</code> so it
          can't be used by accident (see <code className="mono">OracleGuard.sol</code>). If you need the last
          known price for display purposes anyway, read the underlying feed directly --{" "}
          <Link to="/dashboard">this dashboard</Link> does exactly that as a fallback.
        </div>

        <h2 id="guard-reason">The GuardReason enum</h2>
        <p>
          Mirrors <code className="mono">OracleGuard.Reason</code> on-chain exactly -- it's read off-chain as a
          raw <code className="mono">uint8</code>, so the order matters and is guaranteed to stay in sync.{" "}
          <code className="mono">GUARD_REASON_LABELS</code> gives you the human-readable string for each value
          directly, so you never need to hardcode this mapping yourself.
        </p>
        <table className="api-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>GuardReason</th>
              <th>GUARD_REASON_LABELS</th>
            </tr>
          </thead>
          <tbody>
            {REASON_ROWS.map((r) => (
              <tr key={r.name}>
                <td>
                  <code className="mono">{r.value}</code>
                </td>
                <td>
                  <code className="mono">{r.name}</code>
                </td>
                <td>{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <CodeBlock
          code={`import { GuardReason, GUARD_REASON_LABELS } from "@stock-oracle-guard/sdk";

const { isSafe, reason } = await guard.getSafePrice(token);
if (!isSafe) {
  console.log(\`Skipping: \${GUARD_REASON_LABELS[reason]}\`);
  if (reason === GuardReason.SEQUENCER_DOWN) {
    // handle sequencer downtime specifically
  }
}`}
        />

        <h2 id="api-reference" style={{ scrollMarginTop: 90 }}>
          API reference
        </h2>
        <p>
          Six methods, all read-only, all returning promises. Every example below continues from this
          setup -- <code className="mono">guard</code> is the client from the quickstart, and{" "}
          <code className="mono">TSLA</code> is the real testnet Stock Token address.
        </p>
        <CodeBlock code={`const TSLA = "${TSLA}";`} />

        <ApiMethod
          id="constructor"
          async={false}
          signature="new OracleGuardClient(publicClient, oracleGuardAddress)"
          description="Constructs a client bound to one deployed OracleGuard contract."
          params={[
            { name: "publicClient", type: "viem PublicClient", description: "Any viem public client, already pointed at the right chain." },
            { name: "oracleGuardAddress", type: "Address", description: "The deployed OracleGuard contract address." },
          ]}
          returns="OracleGuardClient"
          example={`const guard = new OracleGuardClient(publicClient, "${ORACLE_GUARD_ADDRESS}");`}
        />

        <ApiMethod
          id="get-safe-price"
          signature="getSafePrice(token)"
          description="The core method. Runs every guard check (sequencer uptime, oracle-pause, calendar-aware staleness) and returns whether the current price is safe to use."
          params={[{ name: "token", type: "Address", description: "The Stock Token address (used as the OracleGuard config key)." }]}
          returns="Promise<{ price: bigint; isSafe: boolean; reason: GuardReason; reasonLabel: string }>"
          example={`const { price, isSafe, reasonLabel } = await guard.getSafePrice(TSLA);
if (!isSafe) console.log(\`Skipping: \${reasonLabel}\`);`}
        />

        <ApiMethod
          id="is-liquidation-allowed"
          signature="isLiquidationAllowed(token)"
          description="Shorthand for callers that only need the boolean -- true only when getSafePrice is safe, so liquidations are blocked outright while the oracle is paused, regardless of the last known price."
          params={[{ name: "token", type: "Address", description: "The Stock Token address." }]}
          returns="Promise<boolean>"
          example={`const allowed = await guard.isLiquidationAllowed(TSLA);`}
        />

        <ApiMethod
          id="is-liquidation-allowed-detailed"
          signature="isLiquidationAllowedDetailed(token)"
          description="Same check as isLiquidationAllowed, but also surfaces the reason -- useful for dashboards or bot logs that need to explain why a liquidation was skipped."
          params={[{ name: "token", type: "Address", description: "The Stock Token address." }]}
          returns="Promise<{ allowed: boolean; reason: GuardReason; reasonLabel: string }>"
          example={`const { allowed, reasonLabel } = await guard.isLiquidationAllowedDetailed(TSLA);`}
        />

        <ApiMethod
          id="preflight-liquidation"
          signature="preflightLiquidation(token)"
          description="Alias for isLiquidationAllowedDetailed, named for the common bot use case: check before submitting a liquidate() transaction, so you skip the gas cost of a doomed-to-revert call."
          params={[{ name: "token", type: "Address", description: "The Stock Token address." }]}
          returns="Promise<{ allowed: boolean; reason: GuardReason; reasonLabel: string }>"
          example={`const { allowed } = await guard.preflightLiquidation(TSLA);
if (allowed) {
  // submit the liquidate() transaction
}`}
        />

        <ApiMethod
          id="get-token-config"
          signature="getTokenConfig(token)"
          description="Reads a token's configuration off OracleGuard directly: its price feed address and the weekday/weekend staleness thresholds."
          params={[{ name: "token", type: "Address", description: "The Stock Token address." }]}
          returns="Promise<{ priceFeed: Address; weekdayStaleness: bigint; weekendStaleness: bigint; configured: boolean }>"
          example={`const config = await guard.getTokenConfig(TSLA);
console.log(config.weekdayStaleness, config.weekendStaleness);`}
        />

        <ApiMethod
          id="is-market-open"
          signature="isMarketOpen(timestamp?)"
          description="Whether the reference market is open at the given timestamp, per OracleGuard's configured MarketCalendarRegistry. Defaults to now."
          params={[{ name: "timestamp", type: "bigint (optional)", description: "Unix seconds. Defaults to the current time." }]}
          returns="Promise<boolean>"
          example={`const open = await guard.isMarketOpen();`}
        />

        <h2 id="next-steps">Where to go from here</h2>
        <ul>
          <li>
            See it running live on <Link to="/dashboard">the dashboard</Link> -- the exact same{" "}
            <code className="mono">getSafePrice</code> / <code className="mono">isMarketOpen</code> calls
            documented above, polling every 20 seconds.
          </li>
          <li>
            Walk through a real liquidation on <Link to="/walkthrough">the walkthrough page</Link>, including a
            live run panel you can trigger from your own wallet.
          </li>
          <li>
            Read <code className="mono">sdk/README.md</code> in the repo for the same reference in plain
            Markdown, and <code className="mono">contracts/README.md</code> for how{" "}
            <code className="mono">OracleGuard</code> itself works on-chain.
          </li>
        </ul>
      </div>
    </div>
  );
}
