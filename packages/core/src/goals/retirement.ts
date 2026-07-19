import type { Holding, HoldingType, Valuation } from '@finmanager/schema';

import { roundToPaise } from '../money.js';
import { effectiveHoldingValue, latestValuation } from '../portfolio/analytics.js';

/** Dedicated retirement-account holding types. */
export const RETIREMENT_HOLDING_TYPES: readonly HoldingType[] = ['epf', 'ppf', 'nps'];

export interface RetirementCorpusRow {
  readonly holdingId: string;
  readonly name: string;
  readonly type: HoldingType;
  readonly value: number;
}

export interface RetirementCorpusByType {
  readonly type: HoldingType;
  readonly value: number;
}

export interface RetirementCorpus {
  readonly total: number;
  readonly byType: readonly RetirementCorpusByType[];
  readonly rows: readonly RetirementCorpusRow[];
  readonly missingValueCount: number;
  readonly missingFxCount: number;
}

export interface RetirementCorpusOptions {
  /** Extra holding ids to fold in (e.g. investments earmarked for retirement). */
  readonly extraHoldingIds?: readonly string[];
}

/**
 * Combines EPF/PPF/NPS holdings, plus any explicitly earmarked investment
 * holdings, into a single retirement corpus with a per-type breakdown. Values
 * use the same effective-value precedence as the portfolio engine, and
 * unvalued or missing-FX holdings are counted rather than treated as zero.
 */
export function calculateRetirementCorpus(
  holdings: readonly Holding[],
  valuations: readonly Valuation[],
  options: RetirementCorpusOptions = {},
): RetirementCorpus {
  const extraIds = new Set(options.extraHoldingIds ?? []);
  const retirementTypes = new Set<HoldingType>(RETIREMENT_HOLDING_TYPES);
  const rows: RetirementCorpusRow[] = [];
  const byType = new Map<HoldingType, number>();
  let missingValueCount = 0;
  let missingFxCount = 0;

  for (const holding of holdings) {
    if (!holding.id || !holding.isActive) continue;
    const included = retirementTypes.has(holding.type) || extraIds.has(holding.id);
    if (!included) continue;
    const effective = effectiveHoldingValue(holding, latestValuation(holding.id, valuations));
    if (effective.value === null) {
      if (effective.missingFx) missingFxCount += 1;
      else missingValueCount += 1;
      continue;
    }
    rows.push({
      holdingId: holding.id,
      name: holding.name,
      type: holding.type,
      value: roundToPaise(effective.value),
    });
    byType.set(holding.type, (byType.get(holding.type) ?? 0) + effective.value);
  }

  const total = roundToPaise(rows.reduce((sum, row) => sum + row.value, 0));
  const byTypeRows = [...byType.entries()]
    .map(([type, value]) => ({ type, value: roundToPaise(value) }))
    .sort((left, right) => right.value - left.value);

  return {
    total,
    byType: byTypeRows,
    rows: rows.sort((left, right) => right.value - left.value),
    missingValueCount,
    missingFxCount,
  };
}
