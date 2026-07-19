const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365.25;

/** Today as an ISO date (YYYY-MM-DD), used as the default projection anchor. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fractional years between two ISO dates. Returns 0 when either date is
 * unparseable so downstream growth factors collapse to 1 rather than throwing.
 */
export function yearsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return (to - from) / (DAYS_PER_YEAR * MS_PER_DAY);
}

/** Compound growth factor (1 + rate)^years for a whole-percentage annual rate. */
export function growthFactor(annualPercentRate: number, years: number): number {
  return Math.pow(1 + annualPercentRate / 100, years);
}
