import type { Account, Holding, HoldingEvent, HoldingType, Valuation } from '@finmanager/schema';

import { roundToPaise } from '../money.js';
import { calculateXirr, type XirrCashFlow, type XirrResult } from './xirr.js';

export type AssetClass =
  'equity' | 'retirement' | 'fixed_income' | 'real_estate' | 'gold' | 'crypto' | 'cash';

export interface HoldingCashFlow extends XirrCashFlow {
  readonly holdingId: string;
  readonly currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  readonly fxRateToInr: number | null;
}

export interface NormalizedCashFlows {
  readonly flows: readonly XirrCashFlow[];
  readonly missingFxCount: number;
}

function incompleteFxResult(): XirrResult {
  return { status: 'missing-fx', rate: null, iterations: 0 };
}

export interface HoldingXirr {
  readonly holdingId: string;
  readonly name: string;
  readonly result: XirrResult;
}

export interface AllocationRow {
  readonly assetClass: AssetClass;
  readonly value: number;
  readonly percentage: number;
}

export interface PortfolioSummary {
  readonly investedValue: number;
  readonly currentValue: number;
  readonly netWorth: number;
  readonly gainLoss: number;
  readonly missingValueCount: number;
  readonly unvaluedHoldingCount: number;
  readonly missingFxCount: number;
  readonly isComplete: boolean;
  readonly xirr: XirrResult;
  readonly allocation: readonly AllocationRow[];
  readonly holdingXirr: readonly HoldingXirr[];
  readonly assetClassXirr: readonly {
    readonly assetClass: AssetClass;
    readonly result: XirrResult;
  }[];
}

export function assetClassForType(type: HoldingType): AssetClass {
  if (['mutual_fund', 'stock', 'foreign_stock', 'rsu', 'esop'].includes(type)) return 'equity';
  if (['epf', 'ppf', 'nps'].includes(type)) return 'retirement';
  if (type === 'fd') return 'fixed_income';
  if (type === 'real_estate') return 'real_estate';
  if (type === 'gold') return 'gold';
  if (type === 'crypto') return 'crypto';
  return 'cash';
}

export function latestValuation(
  holdingId: string,
  valuations: readonly Valuation[],
): Valuation | null {
  return (
    valuations
      .filter((valuation) => valuation.holdingId === holdingId)
      .sort((left, right) => right.asOf.localeCompare(left.asOf))[0] ?? null
  );
}

function toInr(
  amount: number,
  currency: HoldingCashFlow['currency'],
  fxRateToInr: number | null,
): number | null {
  if (currency === 'INR') return roundToPaise(amount);
  if (fxRateToInr === null) return null;
  return roundToPaise(amount * fxRateToInr);
}

export function valuationValueInr(valuation: Valuation): number | null {
  return toInr(valuation.value, valuation.currency, valuation.fxRateToInr);
}

export function normalizeCashFlowsToInr(flows: readonly HoldingCashFlow[]): NormalizedCashFlows {
  let missingFxCount = 0;
  const normalized: XirrCashFlow[] = [];
  for (const flow of flows) {
    if (flow.amount === 0) continue;
    const amount = toInr(flow.amount, flow.currency, flow.fxRateToInr);
    if (amount === null) {
      missingFxCount += 1;
      continue;
    }
    normalized.push({ date: flow.date, amount });
  }
  return { flows: normalized, missingFxCount };
}

export interface EffectiveValue {
  readonly value: number | null;
  readonly missingFx: boolean;
}

function resolveAmount(
  amount: number,
  holding: Holding,
  fxRateToInr: number | null,
): EffectiveValue {
  const value = toInr(amount, holding.currency, fxRateToInr);
  return { value, missingFx: value === null };
}

export function effectiveHoldingValue(
  holding: Holding,
  valuation: Valuation | null,
): EffectiveValue {
  if (valuation) {
    const value = toInr(valuation.value, valuation.currency, valuation.fxRateToInr);
    return { value, missingFx: value === null };
  }
  if (holding.manualValueOverride !== null) {
    return resolveAmount(holding.manualValueOverride, holding, holding.manualFxRateToInr);
  }
  if (holding.manualPriceOverride !== null) {
    return resolveAmount(
      holding.manualPriceOverride * holding.quantity,
      holding,
      holding.manualFxRateToInr,
    );
  }
  if (holding.automaticPrice !== null) {
    return resolveAmount(
      holding.automaticPrice * holding.quantity,
      holding,
      holding.automaticPriceFxRateToInr,
    );
  }
  if (holding.currentValue !== null) return resolveAmount(holding.currentValue, holding, null);
  if (holding.currentPrice !== null) {
    return resolveAmount(holding.currentPrice * holding.quantity, holding, null);
  }
  return { value: null, missingFx: false };
}

export function buildHoldingCashFlows(
  holding: Holding,
  events: readonly HoldingEvent[],
  valuation: Valuation | null,
  reportDate = new Date().toISOString().slice(0, 10),
): readonly HoldingCashFlow[] {
  if (!holding.id) return [];
  const flows: HoldingCashFlow[] = events
    .filter((event) => event.holdingId === holding.id)
    .map((event) => ({
      holdingId: holding.id!,
      date: event.occurredOn,
      amount: event.amount,
      currency: event.currency,
      fxRateToInr: event.fxRateToInr,
    }));
  const effective = effectiveHoldingValue(holding, valuation);
  if (effective.value !== null) {
    flows.push({
      holdingId: holding.id,
      date: reportDate,
      amount: effective.value,
      currency: 'INR',
      fxRateToInr: 1,
    });
  }
  return flows;
}

function latestReportDate(
  events: readonly HoldingEvent[],
  valuations: readonly Valuation[],
): string {
  return (
    [...events.map((event) => event.occurredOn), ...valuations.map((valuation) => valuation.asOf)]
      .sort()
      .at(-1) ?? new Date().toISOString().slice(0, 10)
  );
}

export function calculatePortfolioSummary(
  holdings: readonly Holding[],
  events: readonly HoldingEvent[],
  valuations: readonly Valuation[],
  accounts: readonly Account[] = [],
): PortfolioSummary {
  const active = holdings.filter((holding) => holding.isActive && holding.id);
  const reportDate = latestReportDate(events, valuations);
  const holdingData = active.map((holding) => {
    const valuation = latestValuation(holding.id!, valuations);
    const effective = effectiveHoldingValue(holding, valuation);
    const flows = buildHoldingCashFlows(holding, events, valuation, reportDate);
    const normalized = normalizeCashFlowsToInr(flows);
    const historical = normalizeCashFlowsToInr(
      events
        .filter((event) => event.holdingId === holding.id)
        .map((event) => ({
          holdingId: holding.id!,
          date: event.occurredOn,
          amount: event.amount,
          currency: event.currency,
          fxRateToInr: event.fxRateToInr,
        })),
    );
    return {
      holding,
      value: effective.value,
      missingFx: effective.missingFx || normalized.missingFxCount > 0,
      flows,
      normalized,
      historical,
    };
  });
  const valued = holdingData.filter((item) => item.value !== null);
  const current = roundToPaise(valued.reduce((sum, item) => sum + (item.value ?? 0), 0));
  const invested = roundToPaise(
    holdingData.reduce(
      (sum, item) =>
        sum +
        item.historical.flows
          .filter((flow) => flow.amount < 0)
          .reduce((total, flow) => total + Math.abs(flow.amount), 0),
      0,
    ),
  );
  const historicalNet = roundToPaise(
    holdingData.reduce(
      (sum, item) => sum + item.historical.flows.reduce((total, flow) => total + flow.amount, 0),
      0,
    ),
  );
  const cashHoldingAccountIds = new Set(
    active
      .filter((holding) => holding.type === 'cash' && holding.accountId)
      .map((holding) => holding.accountId!),
  );
  const accountMissingFxCount = accounts.filter(
    (account) => account.isActive && account.currency !== 'INR',
  ).length;
  const accountNetWorth = roundToPaise(
    accounts
      .filter(
        (account) =>
          account.isActive &&
          account.currency === 'INR' &&
          account.id &&
          !cashHoldingAccountIds.has(account.id),
      )
      .reduce(
        (sum, account) =>
          sum +
          (account.type === 'credit_card'
            ? -Math.abs(account.currentBalance)
            : account.currentBalance),
        0,
      ),
  );
  const allocationMap = new Map<AssetClass, number>();
  for (const item of valued) {
    const assetClass = assetClassForType(item.holding.type);
    allocationMap.set(assetClass, (allocationMap.get(assetClass) ?? 0) + (item.value ?? 0));
  }
  const allocation = [...allocationMap.entries()]
    .map(([assetClass, value]) => ({
      assetClass,
      value: roundToPaise(value),
      percentage: current === 0 ? 0 : roundToPaise((value / current) * 100),
    }))
    .sort((left, right) => right.value - left.value);
  const holdingXirr = holdingData.map((item) => ({
    holdingId: item.holding.id!,
    name: item.holding.name,
    result: item.missingFx ? incompleteFxResult() : calculateXirr(item.normalized.flows),
  }));
  const classFlows = new Map<AssetClass, XirrCashFlow[]>();
  for (const item of holdingData) {
    const assetClass = assetClassForType(item.holding.type);
    const currentFlows = classFlows.get(assetClass) ?? [];
    currentFlows.push(...item.normalized.flows);
    classFlows.set(assetClass, currentFlows);
  }
  const assetClassXirr = [...classFlows.entries()].map(([assetClass, flows]) => ({
    assetClass,
    result: holdingData
      .filter((item) => assetClassForType(item.holding.type) === assetClass)
      .some((item) => item.missingFx)
      ? incompleteFxResult()
      : calculateXirr(flows),
  }));
  const missingFxCount =
    accountMissingFxCount +
    holdingData.reduce((sum, item) => sum + item.normalized.missingFxCount, 0) +
    holdingData.filter((item) => item.missingFx && item.normalized.missingFxCount === 0).length;
  const missingValueCount = holdingData.filter((item) => item.value === null).length;
  return {
    investedValue: invested,
    currentValue: current,
    netWorth: roundToPaise(current + accountNetWorth),
    gainLoss: roundToPaise(current + historicalNet),
    missingValueCount,
    unvaluedHoldingCount: missingValueCount,
    missingFxCount,
    isComplete: missingValueCount === 0 && missingFxCount === 0,
    xirr:
      missingFxCount > 0
        ? incompleteFxResult()
        : calculateXirr(holdingData.flatMap((item) => item.normalized.flows)),
    allocation,
    holdingXirr,
    assetClassXirr,
  };
}
