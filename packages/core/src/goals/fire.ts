import type { FireSettings, Transaction } from '@finmanager/schema';

import { roundToPaise } from '../money.js';

export const DEFAULT_WITHDRAWAL_RATE = 4;
export const DEFAULT_LEAN_MULTIPLIER = 0.7;
export const DEFAULT_FAT_MULTIPLIER = 1.5;
export const DEFAULT_FIRE_EXPECTED_RETURN = 10;
export const DEFAULT_FIRE_INFLATION = 6;

export type FireVariantKey = 'lean' | 'regular' | 'fat';
export type FireStatus = 'achieved' | 'on_track' | 'off_track';

export interface FireVariant {
  readonly key: FireVariantKey;
  readonly target: number;
  /** currentCorpus / target, clamped to [0, ∞); 1 means the target is met. */
  readonly progress: number;
  readonly achieved: boolean;
}

export interface FireProjection {
  /** Corpus that sustains annual expenses at the withdrawal rate (e.g. 25x). */
  readonly fireNumber: number;
  readonly leanNumber: number;
  readonly fatNumber: number;
  /** Corpus needed today to coast to fireNumber by retirement with no new savings. */
  readonly coastNumber: number;
  readonly currentCorpus: number;
  readonly monthlyContribution: number;
  /**
   * Monthly SIP (today's rupees) that would grow currentCorpus to fireNumber by
   * the retirement age, at the real return rate. Null when there is no
   * retirement horizon (age inputs missing) or no positive FIRE number.
   */
  readonly requiredMonthlyContribution: number | null;
  /**
   * requiredMonthlyContribution − monthlyContribution. Positive means the user
   * must save this much more each month; ≤ 0 means the current rate is enough.
   * Null when requiredMonthlyContribution is null.
   */
  readonly contributionGap: number | null;
  /** Annual real (inflation-adjusted) return as a decimal, e.g. 0.0377. */
  readonly realReturnRate: number;
  readonly progress: number;
  readonly variants: readonly FireVariant[];
  readonly coastAchieved: boolean;
  readonly monthsToFire: number | null;
  readonly yearsToFire: number | null;
  readonly fireAge: number | null;
  readonly status: FireStatus;
}

export interface FireProjectionInput {
  readonly settings: FireSettings;
  /** Investable net worth today, in rupees (typically portfolio net worth). */
  readonly currentCorpus: number;
  /** Amount saved and invested each month, in rupees. */
  readonly monthlyContribution?: number;
  /** Overrides settings.currentAge when the caller has a fresher value. */
  readonly currentAge?: number;
}

function variant(key: FireVariantKey, target: number, currentCorpus: number): FireVariant {
  const progress = target <= 0 ? 0 : currentCorpus / target;
  return { key, target, progress, achieved: target > 0 && currentCorpus >= target };
}

/**
 * Months for `corpus` plus a monthly `sip` to reach `target` at monthly rate
 * `monthlyRate`. Returns null when the target is unreachable (no growth and no
 * savings) or the inputs are degenerate.
 */
function monthsToReach(
  corpus: number,
  sip: number,
  target: number,
  monthlyRate: number,
): number | null {
  if (target <= 0) return null;
  if (corpus >= target) return 0;
  if (monthlyRate === 0) {
    if (sip <= 0) return null;
    return Math.ceil((target - corpus) / sip);
  }
  // corpus·g + sip·(g−1)/r = target, where g = (1+r)^m. Solve for g then m.
  const sipTerm = sip / monthlyRate;
  const denominator = corpus + sipTerm;
  if (denominator <= 0) return null;
  const growth = (target + sipTerm) / denominator;
  if (growth <= 1) return null;
  const months = Math.log(growth) / Math.log(1 + monthlyRate);
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.ceil(months);
}

/**
 * Monthly SIP needed for `corpus` to reach `target` in exactly `months` at
 * monthly rate `monthlyRate`, using the future value of an ordinary annuity.
 * Returns 0 when growth of the current corpus alone already clears the target,
 * and null when the horizon or target is degenerate.
 */
function monthlyContributionToReach(
  corpus: number,
  target: number,
  monthlyRate: number,
  months: number,
): number | null {
  if (target <= 0 || months <= 0) return null;
  if (corpus >= target) return 0;
  if (monthlyRate === 0) {
    return roundToPaise((target - corpus) / months);
  }
  const growth = Math.pow(1 + monthlyRate, months);
  const futureCorpus = corpus * growth;
  if (futureCorpus >= target) return 0;
  // target = futureCorpus + sip·((g−1)/r) ⇒ solve for sip.
  const annuityFactor = (growth - 1) / monthlyRate;
  if (annuityFactor <= 0) return null;
  return roundToPaise((target - futureCorpus) / annuityFactor);
}

export function calculateFireProjection(input: FireProjectionInput): FireProjection {
  const { settings, currentCorpus } = input;
  const monthlyContribution = Math.max(0, input.monthlyContribution ?? 0);

  const withdrawalRate = settings.withdrawalRate || DEFAULT_WITHDRAWAL_RATE;
  const annualExpenses = settings.annualExpenses ?? 0;
  const fireNumber =
    annualExpenses <= 0 ? 0 : roundToPaise(annualExpenses / (withdrawalRate / 100));
  const leanNumber = roundToPaise(
    fireNumber * (settings.leanMultiplier ?? DEFAULT_LEAN_MULTIPLIER),
  );
  const fatNumber = roundToPaise(fireNumber * (settings.fatMultiplier ?? DEFAULT_FAT_MULTIPLIER));

  const expectedReturn = settings.expectedReturn ?? DEFAULT_FIRE_EXPECTED_RETURN;
  const inflation = settings.inflation ?? DEFAULT_FIRE_INFLATION;
  const realReturnRate = (1 + expectedReturn / 100) / (1 + inflation / 100) - 1;

  const currentAge = input.currentAge ?? settings.currentAge;
  const retirementAge = settings.retirementAge;
  const yearsToRetirement =
    currentAge !== null && currentAge !== undefined && retirementAge !== null
      ? Math.max(0, retirementAge - currentAge)
      : null;
  const coastNumber =
    yearsToRetirement === null
      ? fireNumber
      : roundToPaise(fireNumber / Math.pow(1 + realReturnRate, yearsToRetirement));

  const monthlyRate = realReturnRate / 12;
  const monthsToFire = monthsToReach(currentCorpus, monthlyContribution, fireNumber, monthlyRate);
  const yearsToFire = monthsToFire === null ? null : monthsToFire / 12;

  // SIP that hits the FIRE number by the retirement age, and how far the
  // current savings rate falls short of it. Requires a retirement horizon.
  const monthsToRetirement =
    yearsToRetirement === null || yearsToRetirement <= 0
      ? null
      : Math.round(yearsToRetirement * 12);
  const requiredMonthlyContribution =
    monthsToRetirement === null
      ? null
      : monthlyContributionToReach(currentCorpus, fireNumber, monthlyRate, monthsToRetirement);
  const contributionGap =
    requiredMonthlyContribution === null
      ? null
      : roundToPaise(requiredMonthlyContribution - monthlyContribution);
  const fireAge =
    yearsToFire !== null && currentAge !== null && currentAge !== undefined
      ? currentAge + yearsToFire
      : null;

  const progress = fireNumber <= 0 ? 0 : currentCorpus / fireNumber;
  let status: FireStatus;
  if (fireNumber > 0 && currentCorpus >= fireNumber) status = 'achieved';
  else if (
    monthsToFire !== null &&
    (retirementAge === null || fireAge === null || fireAge <= retirementAge)
  ) {
    status = 'on_track';
  } else {
    status = 'off_track';
  }

  return {
    fireNumber,
    leanNumber,
    fatNumber,
    coastNumber,
    currentCorpus: roundToPaise(currentCorpus),
    monthlyContribution: roundToPaise(monthlyContribution),
    requiredMonthlyContribution,
    contributionGap,
    realReturnRate,
    progress,
    variants: [
      variant('lean', leanNumber, currentCorpus),
      variant('regular', fireNumber, currentCorpus),
      variant('fat', fatNumber, currentCorpus),
    ],
    coastAchieved: coastNumber > 0 && currentCorpus >= coastNumber,
    monthsToFire,
    yearsToFire,
    fireAge,
    status,
  };
}

/**
 * Suggests an annual expense baseline from recent monthly spend totals
 * (the average of the provided months, annualised). Returns null when empty.
 */
export function suggestAnnualExpenses(monthlyExpenseTotals: readonly number[]): number | null {
  const months = monthlyExpenseTotals.filter((total) => Number.isFinite(total) && total >= 0);
  if (months.length === 0) return null;
  const averageMonthly = months.reduce((sum, total) => sum + total, 0) / months.length;
  return roundToPaise(averageMonthly * 12);
}

/** Sum debit transaction amounts by month, newest month first. */
export function monthlyExpenseTotals(
  transactions: readonly Pick<Transaction, 'direction' | 'amount' | 'occurredOn'>[],
  window = 12,
): number[] {
  const byMonth = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.direction !== 'debit') continue;
    const month = transaction.occurredOn.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + transaction.amount);
  }
  return [...byMonth.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, window)
    .map(([, total]) => roundToPaise(total));
}

/** Average monthly net savings (credits minus debits), floored at zero. */
export function averageMonthlySavings(
  transactions: readonly Pick<Transaction, 'direction' | 'amount' | 'occurredOn'>[],
  window = 12,
): number {
  const byMonth = new Map<string, number>();
  for (const transaction of transactions) {
    const month = transaction.occurredOn.slice(0, 7);
    const signed = transaction.direction === 'credit' ? transaction.amount : -transaction.amount;
    byMonth.set(month, (byMonth.get(month) ?? 0) + signed);
  }
  const months = [...byMonth.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, window)
    .map(([, total]) => total);
  if (months.length === 0) return 0;
  return roundToPaise(Math.max(0, months.reduce((sum, total) => sum + total, 0) / months.length));
}

/** Converts a safe withdrawal rate percentage to the equivalent expense multiplier. */
export function swrMultiplier(withdrawalRate: number): number {
  return withdrawalRate > 0 ? 100 / withdrawalRate : 0;
}
