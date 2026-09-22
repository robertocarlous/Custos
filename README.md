# Stock Oracle Guard

A reusable on-chain safety layer (+ off-chain SDK) for consuming Chainlink price
feeds on Robinhood Chain Stock Tokens, which trade 24/7 while their feeds only
update 24/5. Any lending or perps protocol on Robinhood Chain can import
`OracleGuard` to get correct staleness handling, oracle-pause handling, and
sequencer-uptime checks out of the box, instead of re-solving them from scratch.

Built for the Arbitrum Open House Singapore Buildathon. Covers the smart
contract and SDK track (Weeks 1-2 of the build plan) plus a live safety-status
dashboard (Week 3, [`frontend/`](frontend/)).

## The gap

- Stock Tokens are ERC-20s with a built-in `uiMultiplier()` (ERC-8056) for
  dividends/splits and an `oraclePaused()` flag during corporate actions --
  Robinhood + Chainlink already solve this part on **mainnet**. (Testnet
  faucet tokens implement `uiMultiplier()` but not `oraclePaused()` --
  see [contracts/README.md](contracts/README.md#testnet-reality-read-before-deploying).)
- What's missing is a reusable, importable library that (a) treats
  weekend/holiday price staleness correctly instead of naively rejecting a
  valid Friday close, (b) blocks liquidations while `oraclePaused()` is true,
  and (c) checks the L2 sequencer uptime feed before trusting any price.

## Repo layout

- [`contracts/`](contracts/) -- Foundry project: `OracleGuard.sol`,
  `MarketCalendarRegistry.sol`, a reference lending pool, and the full test
  suite covering the four safety scenarios (baseline, weekend-staleness,
  oracle-paused, sequencer-down).
- [`sdk/`](sdk/) -- TypeScript Risk SDK (`@stock-oracle-guard/sdk`), a thin
  viem-based wrapper so bots/dashboards can pre-check `OracleGuard` safety
  status before submitting a transaction.
- [`keeper/`](keeper/) -- off-chain keeper script that pushes market-holiday
  overrides to `MarketCalendarRegistry` on a schedule.
- [`frontend/`](frontend/) -- Vite/React safety-status dashboard, live against
  the deployed testnet contracts via the Risk SDK: per-token guard status
  (synced / paused / stale / sequencer-down) and a live pool activity feed.

## Architecture

```
Chainlink price feed ────┐
Stock Token (oraclePaused)├──▶ OracleGuard.sol ──▶ getSafePrice() / isLiquidationAllowed()
Sequencer uptime feed ───┤         ▲
MarketCalendarRegistry ──┘         │
                                    │ imported by
                          ReferenceLendingPool.sol
                                    ▲
                                    │ pre-checked by
                        Risk SDK (TypeScript, off-chain)
                                    ▲
                                    │ consumed by
                          Frontend dashboard (React)
```

`MarketCalendarRegistry` defaults every Mon-Fri to open and every Sat/Sun to
closed; an authorized keeper only needs to push exceptions (holidays, special
sessions) rather than every single day.

## Quickstart

```bash
cd contracts && forge install && forge test

cd .. && npm install                    # installs sdk/keeper/frontend workspaces
npm run build --workspace=sdk && npm test --workspace=sdk
npm run typecheck --workspace=keeper
npm run dev --workspace=frontend         # http://localhost:5173
```

See each subdirectory's README for details.
