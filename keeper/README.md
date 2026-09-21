# @stock-oracle-guard/keeper

Off-chain keeper that pushes market-holiday overrides to
`MarketCalendarRegistry` so `OracleGuard` can apply the correct staleness
threshold on holidays (not just plain weekends, which the contract already
defaults to closed with no keeper action needed).

## Usage

```bash
cp .env.example .env   # fill in RPC_URL, MARKET_CALENDAR_REGISTRY, PRIVATE_KEY
npm install
npm run update-calendar
```

The script diffs `src/holidays.ts` against on-chain state and only submits a
`setDayStatusBatch` call for holidays that aren't already marked `Closed`, so
it's safe to run on a daily cron without spamming transactions.

`PRIVATE_KEY` must belong to an address authorized as a keeper on the
registry (`MarketCalendarRegistry.setKeeper(address, true)`, called by the
contract owner).

`src/holidays.ts` hardcodes the 2026 NYSE holiday calendar for the demo --
swap `getUpcomingHolidays` for a fetch against a live market-calendar source
before relying on this beyond the buildathon.

## Live on testnet

Run against the deployed `MarketCalendarRegistry`
(`0x85dd33A00c072506Ed6Ec445adB8AB704B64a738`, see `contracts/README.md`) on
2026-09-21: pushed the two remaining 2026 holidays (Thanksgiving 2026-11-26,
Christmas 2026-12-25) in one `setDayStatusBatch` transaction. Verified via
`cast call MarketCalendarRegistry.isMarketOpen(uint256)` that both dates now
return `false` while an ordinary weekday next to them still returns `true`,
and confirmed a second run is a no-op ("Calendar already up to date").
