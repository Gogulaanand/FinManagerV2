import type { Goal, GoalKind, Holding, Valuation } from '@finmanager/schema';

import { roundToPaise } from '../money.js';
import { effectiveHoldingValue, latestValuation } from '../portfolio/analytics.js';
import { growthFactor, todayIso, yearsBetween } from './time.js';

/** Fallback assumptions when a goal does not carry its own rates. */
export const DEFAULT_EXPECTED_RETURN = 12;
export const DEFAULT_INFLATION = 6;

export type GoalStatus = 'achieved' | 'on_track' | 'off_track';

export interface LinkedHoldingValue {
  readonly value: number;
  readonly missingValueCount: number;
  readonly missingFxCount: number;
}

export interface GoalProjection {
  readonly goalId: string | null;
  readonly name: string;
  readonly kind: GoalKind;
  /** Fractional years from the anchor date to the target date (0 if undated). */
  readonly years: number;
  /** Inflation-adjusted cost at the target date, in rupees. */
  readonly inflatedTarget: number;
  /** Money earmarked today: the goal's currentAmount plus linked holding values. */
  readonly currentFunding: number;
  /** currentFunding grown at the expected return to the target date. */
  readonly projectedValue: number;
  /** Shortfall at the target date after growth (0 when fully on track). */
  readonly gap: number;
  /** Excess over the target at the target date (0 when short). */
  readonly surplus: number;
  /** Additional monthly SIP required to close the gap by the target date. */
  readonly requiredMonthlySip: number;
  /** projectedValue / inflatedTarget, clamped to [0, ∞); 1 means exactly funded. */
  readonly fundingRatio: number;
  readonly status: GoalStatus;
  readonly expectedReturn: number;
  readonly inflation: number;
  readonly missingLinkedValueCount: number;
  readonly missingLinkedFxCount: number;
}

export interface GoalProjectionOptions {
  readonly asOf?: string;
  readonly holdings?: readonly Holding[];
  readonly valuations?: readonly Valuation[];
  readonly defaultExpectedReturn?: number;
  readonly defaultInflation?: number;
}

/**
 * Sums the effective INR value of the given linked holdings, reusing the same
 * manual-override / valuation / quote precedence as the portfolio engine.
 */
export function sumLinkedHoldingValue(
  linkedHoldingIds: readonly string[],
  holdings: readonly Holding[],
  valuations: readonly Valuation[],
): LinkedHoldingValue {
  const ids = new Set(linkedHoldingIds);
  let value = 0;
  let missingValueCount = 0;
  let missingFxCount = 0;
  for (const holding of holdings) {
    if (!holding.id || !ids.has(holding.id)) continue;
    const effective = effectiveHoldingValue(holding, latestValuation(holding.id, valuations));
    if (effective.value === null) {
      if (effective.missingFx) missingFxCount += 1;
      else missingValueCount += 1;
    } else {
      value += effective.value;
    }
  }
  return { value: roundToPaise(value), missingValueCount, missingFxCount };
}

/**
 * Monthly SIP whose ordinary-annuity future value equals `futureGap` after
 * `years` at the given annual return. When the horizon is non-positive the gap
 * is required immediately, so the whole amount is returned.
 */
export function requiredMonthlySip(
  futureGap: number,
  annualReturnPercent: number,
  years: number,
): number {
  if (futureGap <= 0) return 0;
  const months = Math.round(years * 12);
  if (months <= 0) return roundToPaise(futureGap);
  const monthlyRate = annualReturnPercent / 100 / 12;
  if (monthlyRate === 0) return roundToPaise(futureGap / months);
  const annuityFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  return roundToPaise(futureGap / annuityFactor);
}

export function calculateGoalProjection(
  goal: Goal,
  options: GoalProjectionOptions = {},
): GoalProjection {
  const asOf = options.asOf ?? todayIso();
  const holdings = options.holdings ?? [];
  const valuations = options.valuations ?? [];
  const expectedReturn =
    goal.expectedReturn ?? options.defaultExpectedReturn ?? DEFAULT_EXPECTED_RETURN;
  const inflation = goal.inflation ?? options.defaultInflation ?? DEFAULT_INFLATION;
  const years = goal.targetDate ? Math.max(0, yearsBetween(asOf, goal.targetDate)) : 0;

  const linked = sumLinkedHoldingValue(goal.linkedHoldingIds, holdings, valuations);
  const currentFunding = roundToPaise(goal.currentAmount + linked.value);
  const inflatedTarget = roundToPaise(goal.targetAmount * growthFactor(inflation, years));
  const projectedValue = roundToPaise(currentFunding * growthFactor(expectedReturn, years));

  const gap = roundToPaise(Math.max(0, inflatedTarget - projectedValue));
  const surplus = roundToPaise(Math.max(0, projectedValue - inflatedTarget));
  const sip = requiredMonthlySip(gap, expectedReturn, years);
  const fundingRatio =
    inflatedTarget <= 0 ? (currentFunding > 0 ? 1 : 0) : projectedValue / inflatedTarget;

  let status: GoalStatus;
  if (inflatedTarget <= 0 || currentFunding >= inflatedTarget) status = 'achieved';
  else if (gap <= 0) status = 'on_track';
  else status = 'off_track';

  return {
    goalId: goal.id ?? null,
    name: goal.name,
    kind: goal.kind,
    years,
    inflatedTarget,
    currentFunding,
    projectedValue,
    gap,
    surplus,
    requiredMonthlySip: sip,
    fundingRatio,
    status,
    expectedReturn,
    inflation,
    missingLinkedValueCount: linked.missingValueCount,
    missingLinkedFxCount: linked.missingFxCount,
  };
}

export function calculateGoalProjections(
  goals: readonly Goal[],
  options: GoalProjectionOptions = {},
): readonly GoalProjection[] {
  return goals.map((goal) => calculateGoalProjection(goal, options));
}
