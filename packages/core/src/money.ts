/**
 * Rounds a rupee amount to whole paise (2 decimal places).
 *
 * Uses half-up rounding on the absolute value so that -1.005 and 1.005 round
 * symmetrically; JavaScript's Math.round would bias negatives toward zero.
 *
 * Paise-accurate up to ~1e10 rupees (1,000 crore): beyond that the
 * toPrecision(12) float correction starts rounding into the integer part.
 */
export function roundToPaise(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`roundToPaise expects a finite number, received ${amount}`);
  }
  const sign = amount < 0 ? -1 : 1;
  // Scale via string-free arithmetic, then correct the float representation
  // error that makes values like 1.005 * 100 land on 100.49999999999999.
  const scaled = Math.abs(amount) * 100;
  const rounded = Math.round(Number(scaled.toPrecision(12)));
  return (sign * rounded) / 100;
}
