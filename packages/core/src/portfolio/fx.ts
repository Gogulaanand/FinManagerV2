/**
 * Converts a user-entered FX rate into the value accepted by portfolio
 * records. INR is already the reporting currency, so it never needs a rate.
 */
export function fxRateToInrForCurrency(
  currency: string,
  rawRate: string | number | null | undefined,
): number | null {
  if (currency === 'INR') return null;

  const rate = Number(rawRate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
