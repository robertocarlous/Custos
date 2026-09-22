# Stock Oracle Guard -- Frontend

Marketing/demo site + live safety-status dashboard for `OracleGuard`, running
against the deployed Robinhood Chain testnet contracts. Viewing is read-only
(no wallet needed, just an RPC); the walkthrough page also supports actually
running the deposit → borrow → crash → liquidate sequence from a connected
wallet.

Built with Vite + React + TypeScript + React Router, consuming
`@stock-oracle-guard/sdk` (`OracleGuardClient`) for all safety-status reads.
The write-flow and activity feed talk to `ReferenceLendingPool` directly
(`src/config/poolAbi.ts`) since the SDK only wraps `OracleGuard` /
`MarketCalendarRegistry`, not the reference pool.

## Run it

From the repo root (this is an npm workspace):

```bash
npm install
npm run build --workspace=sdk   # the SDK must be built once before the frontend can import it
npm run dev --workspace=frontend
```

Or from within `frontend/`:

```bash
npm run dev
```

## Pages

- **`/` -- Overview.** Landing page: what OracleGuard solves, how the pieces
  fit together, and a live (not mocked) preview of the safety cards pulled
  from the same hook the dashboard uses -- so the pitch and the product are
  never out of sync.
- **`/dashboard` -- Safety status.** Per-token safety cards (TSLA, AMZN,
  NFLX -- every token `Deploy.s.sol` configures on `OracleGuard`) plus the
  live pool activity feed. See below for the status derivation.
- **`/walkthrough` -- Liquidation walkthrough.** Visualizes the deposit →
  borrow → crash → liquidate sequence from
  `contracts/script/liquidation-walkthrough.sh`, cross-referencing each step
  against real on-chain events (auto-detected, not hardcoded), a
  naive-vs-guarded comparison, and a **live run panel** to actually execute
  the sequence from a connected wallet (see below).

## What it shows

- **Safety statuses**, derived from `GuardReason` + `GUARD_REASON_LABELS` in
  the SDK (`src/lib/status.ts`):
  - `SYNCED` -- fresh price, market open, `getSafePrice` returns `OK`.
  - `STALE-BUT-SAFE` -- market closed (weekend/holiday) but still within the
    wider off-hours staleness threshold.
  - `STALE` -- price age exceeds the calendar-aware threshold.
  - `PAUSED` -- the Stock Token's `oraclePaused()` is true.
  - `SEQUENCER-DOWN` -- L2 sequencer down or still in its restart grace period.

  When a card is unsafe, `getSafePrice` intentionally zeroes the price
  on-chain (see `OracleGuard.sol`) so callers can't act on it by accident.
  For display only, the card falls back to reading the token's price feed
  directly to show the last known price and its age.

- **Pool activity feed** -- live `Deposit` / `Borrow` / `Repay` / `Withdraw`
  / `Liquidate` events read directly from `ReferenceLendingPool`, newest
  first, each linking to the testnet explorer. Rerun
  `contracts/script/liquidation-walkthrough.sh` against a fresh account and
  the new transactions show up here (and on the walkthrough page)
  automatically, no frontend changes needed.

Safety cards and the activity feed poll on an interval (20s / 30s) so
everything stays live during a demo.

- **Live run panel** (`/walkthrough`) -- connects an injected wallet
  (MetaMask or similar), prompts a network switch to Robinhood Chain Testnet
  if needed, and exposes four real actions against `ReferenceLendingPool`:
  deposit collateral (auto-approves if allowance is short), borrow dUSD,
  crash the demo price feed (`MockAggregatorV3.setAnswer` has no access
  control, so any wallet can do this on testnet), and liquidate (defaults to
  self-liquidating your own position). Every write simulates first
  (`publicClient.simulateContract`) so reverts come back as a decoded
  `OracleGuard.Reason` instead of a raw hex selector. You need real testnet
  TSLA from the faucet to deposit -- the panel links to it if your balance is
  zero. Wallet state lives in one `WalletProvider` context (`src/context/`)
  so the nav's connect button and the panel never fall out of sync.

## Structure

```
src/
  pages/           Overview, Dashboard, Walkthrough, NotFound
  layouts/         SiteLayout (nav + footer + <Outlet/>)
  context/         WalletProvider -- single shared wallet connection
  components/      Nav, Footer, TokenCard, ActivityFeed, wallet/ (connect + live-run UI)
  hooks/           useSafetyDashboard, useActivityFeed, usePoolPosition, useTxRunner
  lib/             status.ts (GuardReason -> dashboard status), tx.ts (simulate/write/decode)
  config/          deployed addresses, chain def, ABIs (SDK covers OracleGuard; local ABIs cover the pool/ERC-20/feed)
```

## Config

All deployed addresses live in `src/config/deployment.ts`, matching
`contracts/README.md`'s "Live on testnet" section. If the contracts are
redeployed, update addresses there.

## Deploying

This is a client-side-routed SPA. Any static host needs to fall back to
`index.html` for unknown paths (so `/dashboard` works on a direct load /
refresh, not just via in-app navigation). `public/_redirects` covers Netlify;
Vercel and most other Vite-aware hosts detect this automatically.
