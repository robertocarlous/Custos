# Stock Oracle Guard -- Contracts

Foundry project targeting Robinhood Chain testnet (chain ID `46630`).

## Contracts

- **`src/OracleGuard.sol`** -- the core safety library/contract. Per Stock
  Token, `getSafePrice(token)` runs three checks before returning a price:
  1. L2 sequencer is up, and past `sequencerGracePeriod` since its last restart.
  2. `IStockToken(token).oraclePaused()` is `false` -- checked via a
     try/catch (`_isOraclePaused`) that treats a revert as "not paused",
     since real Robinhood Chain **testnet** faucet Stock Tokens don't
     implement `oraclePaused()` at all (only mainnet tokens do -- see
     "Testnet reality" below).
  3. The Chainlink feed isn't stale, using a **calendar-aware threshold**:
     `weekdayStaleness` while `MarketCalendarRegistry.isMarketOpen()` is true,
     `weekendStaleness` while it's false.

  `isLiquidationAllowed(token)` is `true` only when `getSafePrice` is safe --
  so liquidations are blocked outright while the oracle is paused, regardless
  of the last known price.

- **`src/MarketCalendarRegistry.sol`** -- on-chain open/closed state per UTC
  day. Defaults to Mon-Fri open / Sat-Sun closed (epoch-day arithmetic, no
  storage needed for the common case); an authorized keeper pushes overrides
  for holidays or special sessions via `setDayStatus` / `setDayStatusBatch`.

- **`src/ReferenceLendingPool.sol`** -- minimal single-collateral
  (Stock Token) / single-borrow-asset (USD stable) pool demonstrating correct
  integration: borrows revert if the oracle isn't safe, and `liquidate()`
  reverts with the specific `OracleGuard.Reason` if liquidation isn't allowed.
  Not a production money market (no interest accrual, single asset pair only).

## Setup

Dependencies (`forge-std`, OpenZeppelin) aren't committed to this repo --
fetch them once after cloning:

```bash
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
cp .env.example .env   # fill in RPC/keys
forge build
forge test -vv --no-match-path "test/fork/*"
```

## Mainnet fork tests

`test/fork/OracleGuardMainnetFork.t.sol` forks Robinhood Chain **mainnet**
(chain 4663) and runs `OracleGuard` against the real Chainlink TSLA feed and
the real TSLA Stock Token -- the only way to prove the `oraclePaused()` check
works against the genuine interface, since testnet faucet tokens don't
implement it at all. Only the (nonexistent, on any Robinhood network) Chainlink
sequencer uptime feed is mocked; everything else is real, live mainnet state.
Confirmed passing with real data flowing through: `oraclePaused()` resolving
through TSLA's real proxy/implementation pattern, a real feed price, and
`getSafePrice` returning a price that exactly matches the raw feed's answer.

Needs network access and isn't part of the default `forge test` run:

```bash
forge test --match-path "test/fork/*" --fork-url https://rpc.mainnet.chain.robinhood.com -vv
```

## Live liquidation walkthrough

`script/liquidation-walkthrough.sh` runs a full deposit -> borrow -> price
crash -> liquidate cycle against a live `ReferenceLendingPool` deployment,
using one account as both borrower and liquidator. Already run once against
the live testnet deployment above on 2026-09-21, with every step confirmed
on-chain:

1. Approved and deposited 5 real testnet TSLA as collateral (~$2,000 at the
   $400 demo price).
2. Confirmed `liquidate()` reverts with `PositionIsHealthy()` before any debt exists.
3. Borrowed 1,000 dUSD (50% LTV, well under the 70% max).
4. Crashed the demo TSLA feed to $150/share -- collateral value drops to
   $750, below the 80% liquidation threshold against $1,000 debt.
   `getSafePrice` still returns `isSafe = true` (the *price* is fine, only the
   *position* is underwater) and `isLiquidationAllowed` returns `true`.
5. Liquidated 200 dUSD of debt. Real transaction:
   [`0x1bd76375dcb7a37251ddf874f146d18bfe6e2116e720d419b93a544944a6f2a4`](https://explorer.testnet.chain.robinhood.com/tx/0x1bd76375dcb7a37251ddf874f146d18bfe6e2116e720d419b93a544944a6f2a4).
   Seized `1.4667 TSLA` (`= 200 * 1.10 / 150`, matching the contract's bonus
   formula exactly), leaving `3.5333 TSLA` collateral and `800 dUSD` debt.

Rerun it yourself (against a fresh account with its own collateral, since the
live account above already has an open position):

```bash
RPC_URL=https://rpc.testnet.chain.robinhood.com \
POOL=0xD3d3229F974BCF1B344f2F3F47D876e5CD139507 \
GUARD=0x36D03E7a80Ee403c779095c825340c9bf92f2740 \
FEED=0xF161b46cbF7568ce81e7693BFD8C6b573819586c \
TOKEN=0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E \
BORROW_TOKEN=0x2C8dcd15204c0976fA88A788C95C2718FbfA466d \
PRIVATE_KEY=0x... \
  ./script/liquidation-walkthrough.sh
```

## Test scenarios

`test/OracleGuard.t.sol` and `test/ReferenceLendingPool.t.sol` cover:

| Scenario | Expected behavior |
|---|---|
| Baseline: fresh price, market open | Behaves like a plain price feed |
| Weekend: price 50h stale, market closed | Still `isSafe = true` (wide threshold) |
| Weekend: price 100h stale, market closed | `isSafe = false`, `STALE_PRICE` |
| Paused: fresh price, `oraclePaused() == true` | `isSafe = false`, liquidation blocked |
| Sequencer down | `isSafe = false`, `SEQUENCER_DOWN` |
| Sequencer just restarted | `isSafe = false`, `SEQUENCER_GRACE_PERIOD` |

## Live on testnet

Deployed and verified working end-to-end on Robinhood Chain testnet (chain 46630) on 2026-09-21:

| Contract | Address |
|---|---|
| MarketCalendarRegistry | `0x85dd33A00c072506Ed6Ec445adB8AB704B64a738` |
| OracleGuard | `0x36D03E7a80Ee403c779095c825340c9bf92f2740` |
| Mock sequencer uptime feed | `0x948046E235CB03bd96c177fCcab9CF9af5E0923a` |
| Mock TSLA price feed | `0xF161b46cbF7568ce81e7693BFD8C6b573819586c` |
| Mock AMZN price feed | `0x4Ada3e1085EeeD87509BD7D9a0C65EB0B6C64508` |
| Mock NFLX price feed | `0x75B95D0ec797F11cecf84043F86efAF13f5F5cc6` |
| Demo borrow asset (dUSD) | `0x2C8dcd15204c0976fA88A788C95C2718FbfA466d` |
| ReferenceLendingPool (TSLA collateral) | `0xD3d3229F974BCF1B344f2F3F47D876e5CD139507` |

Verified live: `OracleGuard.getSafePrice(TESTNET_TSLA)` returns `(40000000000, true, OK)`
and `isLiquidationAllowed(TESTNET_TSLA)` returns `true` once past the sequencer
grace period -- confirmed via `cast call` against
`https://rpc.testnet.chain.robinhood.com`. Browse these on
[explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com).

## Testnet reality (read before deploying)

The public testnet explorer is full of copycat/spam tokens (duplicate ticker
symbols, `certified: false` on everything). The addresses that actually work
were cross-verified two ways: (1) directly against the live testnet RPC with
`cast call <addr> "uiMultiplier()(uint256)"` / `"oraclePaused()(bool)"`, and
(2) against Arbitrum Foundation's own Robinhood Chain example app
([github.com/hummusonrails/robinhood-chain-dapp-example](https://github.com/hummusonrails/robinhood-chain-dapp-example)),
whose deploy script hardcodes the same addresses as real testnet faucet
tokens.

Two things are true on testnet that are **not** true on mainnet:

- Chainlink has not deployed real price feeds or a sequencer uptime feed on
  Robinhood Chain testnet at all. `Deploy.s.sol` deploys its own
  `MockAggregatorV3` for both, same as the reference app above.
- Testnet faucet Stock Tokens don't implement `oraclePaused()` -- calling it
  reverts. `OracleGuard._isOraclePaused()` catches that and treats it as "not
  paused" rather than bricking every price read.

Real testnet faucet Stock Tokens used by `Deploy.s.sol` (dispensed by
faucet.testnet.chain.robinhood.com):

| Ticker | Address |
|---|---|
| TSLA | `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E` |
| AMZN | `0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02` |
| NFLX | `0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93` |

## Deploying

```bash
cp .env.example .env   # fill in PRIVATE_KEY at minimum
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --broadcast
```

On testnet (chain 46630) this needs only `PRIVATE_KEY` -- the script deploys
mock feeds itself and configures `OracleGuard` for the three tokens above,
plus a demo `ReferenceLendingPool`.

For **mainnet** (chain 4663), real Chainlink infra exists. Set
`SEQUENCER_UPTIME_FEED`, `MAINNET_TOKENS`, and `MAINNET_FEEDS` (comma-separated,
same order) in `.env` -- verify every address yourself against
[docs.robinhood.com/chain/contracts](https://docs.robinhood.com/chain/contracts/)
and [Chainlink's Robinhood feed list](https://docs.chain.link/data-feeds/price-feeds/addresses?network=robinhood)
before deploying. Never trust a hardcoded address (including the ones in this
repo) without independently checking it responds to `oraclePaused()` /
`uiMultiplier()` the way you expect.
