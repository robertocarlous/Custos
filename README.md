# Stock Oracle Guard

A reusable on-chain safety layer (+ off-chain SDK) for consuming Chainlink price
feeds on Robinhood Chain Stock Tokens, which trade 24/7 while their feeds only
update 24/5. Any lending or perps protocol on Robinhood Chain can import
`OracleGuard` to get correct staleness handling, oracle-pause handling, and
sequencer-uptime checks out of the box, instead of re-solving them from scratch.

Built for the Arbitrum Open House Singapore Buildathon. Covers the smart
contract and SDK track (Weeks 1-2 of the build plan) plus a full frontend
(Week 3, [`frontend/`](frontend/)): a live safety-status dashboard, a
liquidation walkthrough you can run for real from a connected wallet, and
SDK documentation, all reading the same live testnet deployment below.

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
- [`frontend/`](frontend/) -- Vite/React app, live against the deployed
  testnet contracts via the Risk SDK: an overview page, a safety-status
  dashboard (per-token guard status + live pool activity feed), a
  liquidation walkthrough with a real wallet-connected write-flow, and a
  Hardhat-style `/docs` reference for the SDK itself.

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

## Live on testnet

Deployed and verified working end-to-end on Robinhood Chain testnet (chain
`46630`) on 2026-09-21 -- see [contracts/README.md](contracts/README.md#live-on-testnet)
for the full list (price feeds, mock sequencer feed) and the "testnet
reality" caveats about faucet tokens. The four addresses everything in this
repo (SDK examples, frontend, docs) is pre-configured to use:

| Contract | Address |
|---|---|
| OracleGuard | `0x36D03E7a80Ee403c779095c825340c9bf92f2740` |
| MarketCalendarRegistry | `0x85dd33A00c072506Ed6Ec445adB8AB704B64a738` |
| ReferenceLendingPool (TSLA collateral) | `0xD3d3229F974BCF1B344f2F3F47D876e5CD139507` |
| Demo borrow asset (dUSD) | `0x2C8dcd15204c0976fA88A788C95C2718FbfA466d` |

RPC: `https://rpc.testnet.chain.robinhood.com` -- explorer:
[explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com).
Real testnet TSLA collateral for the demo comes from
[faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com).

A real liquidation has already run end-to-end against this deployment:
[`0x1bd76375dcb7a37251ddf874f146d18bfe6e2116e720d419b93a544944a6f2a4`](https://explorer.testnet.chain.robinhood.com/tx/0x1bd76375dcb7a37251ddf874f146d18bfe6e2116e720d419b93a544944a6f2a4)
-- see it visualized on the frontend's `/walkthrough` page, or rerun it
yourself against a fresh account with
[`contracts/script/liquidation-walkthrough.sh`](contracts/script/liquidation-walkthrough.sh).

## Quickstart

```bash
cd contracts && forge install && forge test

cd .. && npm install                    # installs sdk/keeper/frontend workspaces
npm run build --workspace=sdk && npm test --workspace=sdk
npm run typecheck --workspace=keeper
npm run dev --workspace=frontend         # http://localhost:5173
```

Then visit:

| Route | What's there |
|---|---|
| `/` | Overview -- what OracleGuard solves and how the pieces fit together |
| `/dashboard` | Live per-token safety status + pool activity feed |
| `/walkthrough` | The liquidation sequence above, visualized -- plus a live run panel |
| `/docs` | SDK reference: installation, quickstart, project setup, full API |

See each subdirectory's README for details.

## License

[MIT](LICENSE).
