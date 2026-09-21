/**
 * NYSE-style market holidays (full-day closures), used as the reference calendar
 * for Robinhood Stock Tokens. MarketCalendarRegistry already defaults every
 * Mon-Fri to open and every Sat/Sun to closed on-chain, so the keeper's only job
 * is pushing the exceptions: holidays here, and any ad-hoc special sessions via
 * the same setDayStatusBatch call.
 *
 * Hardcoded for the demo; swap `getUpcomingHolidays` for a fetch against a live
 * market-calendar API (e.g. Nasdaq Trader or an exchange calendar feed) in
 * production so the list never drifts out of date.
 *
 * NOTE: verify against the official NYSE holiday calendar before relying on
 * this for anything beyond the buildathon demo.
 */
export const NYSE_HOLIDAYS_2026: string[] = [
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Washington's Birthday
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day (observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving Day
  "2026-12-25", // Christmas Day
];

export function getUpcomingHolidays(fromDate: Date = new Date()): string[] {
  const fromDayId = Math.floor(fromDate.getTime() / 86_400_000);
  return NYSE_HOLIDAYS_2026.filter((iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000) >= fromDayId);
}

export function isoDateToDayId(iso: string): bigint {
  return BigInt(Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000));
}
