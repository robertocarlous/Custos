# @stock-oracle-guard/sdk

Thin [viem](https://viem.sh)-based wrapper around an on-chain `OracleGuard`
deployment, so liquidation bots and dashboards can run the exact same safety
checks the contract enforces -- off-chain and for free -- before submitting a
transaction that would otherwise revert.

## Install

Within this monorepo:

```bash
npm install
npm run build
```

## Usage

```ts
import { createPublicClient, http } from "viem";
import { OracleGuardClient, GuardReason } from "@stock-oracle-guard/sdk";

const publicClient = createPublicClient({ transport: http("https://rpc.testnet.chain.robinhood.com") });
const guard = new OracleGuardClient(publicClient, "0xOracleGuardAddress");

const { isSafe, price, reasonLabel } = await guard.getSafePrice("0xStockTokenAddress");
if (!isSafe) {
  console.log(`Skipping: ${reasonLabel}`);
}

// Before submitting a liquidate() tx, pre-check so you don't waste gas on a revert:
const { allowed, reason } = await guard.preflightLiquidation("0xStockTokenAddress");
if (allowed) {
  // submit the liquidation transaction
}
```

## API

- `getSafePrice(token)` -> `{ price, isSafe, reason, reasonLabel }`
- `isLiquidationAllowed(token)` -> `boolean`
- `isLiquidationAllowedDetailed(token)` / `preflightLiquidation(token)` -> `{ allowed, reason, reasonLabel }`
- `getTokenConfig(token)` -> `{ priceFeed, weekdayStaleness, weekendStaleness, configured }`
- `isMarketOpen(timestamp?)` -> `boolean`

`GuardReason` mirrors `OracleGuard.Reason` on-chain exactly (`OK`,
`NOT_CONFIGURED`, `SEQUENCER_DOWN`, `SEQUENCER_GRACE_PERIOD`, `ORACLE_PAUSED`,
`STALE_PRICE`, `INVALID_PRICE`) -- keep the two in sync if the contract enum
ever changes order.

## Live testnet check

`examples/live-testnet-check.ts` points the client at the deployed
`OracleGuard` on Robinhood Chain testnet (see `contracts/README.md` for the
address) and reads live state for the real testnet TSLA Stock Token:

```bash
npm run example:live-testnet
```

Expected output looks like:

```
getSafePrice(TSLA): { price: 40000000000n, isSafe: true, reason: 0, reasonLabel: 'OK' }
preflightLiquidation(TSLA): { allowed: true, reason: 0, reasonLabel: 'OK' }
isMarketOpen(): true
getTokenConfig(TSLA): { priceFeed: '0x...', weekdayStaleness: 3600n, weekendStaleness: 273600n, configured: true }
```
