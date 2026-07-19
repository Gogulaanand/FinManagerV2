import {
  FinancialDigestSchema,
  type Account,
  type Budget,
  type Category,
  type FinancialDigest,
  type FireSettings,
  type Goal,
  type Holding,
  type HoldingEvent,
  type InsightScope,
  type Transaction,
  type Valuation,
} from '@finmanager/schema';

import {
  buildMonthlyTrend,
  calculateBudgetProgress,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
} from '../expenses/analytics.js';
import { calculateFireProjection } from '../goals/fire.js';
import { calculateGoalProjections } from '../goals/goals.js';
import { calculateRetirementCorpus } from '../goals/retirement.js';
import { roundToPaise } from '../money.js';
import {
  calculatePortfolioSummary,
  effectiveHoldingValue,
  latestValuation,
} from '../portfolio/analytics.js';

export interface TaxDigestInput {
  readonly financialYear?: string | null;
  readonly preferredRegime?: string | null;
  readonly taxableIncome?: number | null;
  readonly taxPayable?: number | null;
  readonly monthlyInHand?: number | null;
}

export interface BuildFinancialDigestInput {
  readonly transactions: readonly Transaction[];
  readonly categories: readonly Category[];
  readonly budgets: readonly Budget[];
  readonly holdings: readonly Holding[];
  readonly events: readonly HoldingEvent[];
  readonly valuations: readonly Valuation[];
  readonly accounts?: readonly Account[];
  readonly goals: readonly Goal[];
  readonly fireSettings: FireSettings | null;
  readonly tax?: TaxDigestInput | null;
  readonly month: string;
  readonly generatedAt?: string;
}

type DigestSection = 'expenses' | 'budget' | 'portfolio' | 'goals' | 'tax';

const scopeSections: Readonly<Record<InsightScope, readonly DigestSection[]>> = {
  everything: ['expenses', 'budget', 'portfolio', 'goals', 'tax'],
  expenses: ['expenses'],
  budget: ['budget'],
  portfolio: ['portfolio'],
  goals: ['goals'],
  tax: ['tax'],
};

function sum(values: readonly number[]): number {
  return roundToPaise(values.reduce((total, value) => total + value, 0));
}

function roundOptional(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : roundToPaise(value);
}

export function buildFinancialDigest(
  scope: InsightScope,
  input: BuildFinancialDigestInput,
): FinancialDigest {
  const sections = new Set(scopeSections[scope]);
  const missingSections: DigestSection[] = [];
  const result: Record<string, unknown> = {
    version: 1,
    scope,
    month: input.month,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };

  if (sections.has('expenses')) {
    const summary = calculateMonthlySummary(input.transactions, input.categories, input.month);
    const hasData = summary.transactionCount > 0;
    if (!hasData) missingSections.push('expenses');
    result.expenses = {
      hasData,
      debit: hasData ? summary.debit : null,
      credit: hasData ? summary.credit : null,
      net: hasData ? summary.net : null,
      transactionCount: summary.transactionCount,
      topCategories: calculateCategoryBreakdown(input.transactions, input.categories, input.month)
        .slice(0, 5)
        .map((category) => ({
          name: category.label,
          amount: category.amount,
          percentage: category.percentage,
        })),
      monthlyTrend: buildMonthlyTrend(input.transactions, input.categories, input.month, 6).map(
        (point) => ({ month: point.month, debit: point.debit, credit: point.credit }),
      ),
    };
  }

  if (sections.has('budget')) {
    const progress = calculateBudgetProgress(
      input.budgets,
      input.transactions,
      input.categories,
      input.month,
    );
    const hasData = progress.length > 0;
    if (!hasData) missingSections.push('budget');
    result.budget = {
      hasData,
      totalBudget: hasData ? sum(progress.map((item) => item.budget)) : null,
      totalSpent: hasData ? sum(progress.map((item) => item.actual)) : null,
      overspentCount: progress.filter((item) => item.status === 'overspent').length,
      categories: progress.slice(0, 8).map((item) => ({
        name: item.label,
        budget: item.budget,
        actual: item.actual,
        status: item.status,
      })),
    };
  }

  const portfolio = calculatePortfolioSummary(
    input.holdings,
    input.events,
    input.valuations,
    input.accounts ?? [],
  );
  const hasPortfolioData =
    input.holdings.some((holding) => holding.isActive) ||
    (input.accounts ?? []).some((account) => account.isActive);

  if (sections.has('portfolio')) {
    if (!hasPortfolioData) missingSections.push('portfolio');
    const topHoldings = input.holdings
      .filter((holding) => holding.isActive)
      .map((holding) => ({
        name: holding.name,
        type: holding.type,
        value: effectiveHoldingValue(
          holding,
          holding.id ? latestValuation(holding.id, input.valuations) : null,
        ).value,
      }))
      .sort((left, right) => (right.value ?? -1) - (left.value ?? -1))
      .slice(0, 5);
    result.portfolio = {
      hasData: hasPortfolioData,
      investedValue: hasPortfolioData ? portfolio.investedValue : null,
      currentValue: hasPortfolioData ? portfolio.currentValue : null,
      netWorth: hasPortfolioData ? portfolio.netWorth : null,
      gainLoss: hasPortfolioData ? portfolio.gainLoss : null,
      xirrPercent:
        hasPortfolioData && portfolio.xirr.rate !== null
          ? roundToPaise(portfolio.xirr.rate * 100)
          : null,
      isComplete: hasPortfolioData && portfolio.isComplete,
      missingValueCount: portfolio.missingValueCount,
      missingFxCount: portfolio.missingFxCount,
      allocation: portfolio.allocation.slice(0, 8),
      topHoldings,
    };
  }

  if (sections.has('goals')) {
    const hasData = input.goals.length > 0 || input.fireSettings !== null;
    if (!hasData) missingSections.push('goals');
    const projections = calculateGoalProjections(input.goals, {
      asOf: `${input.month}-01`,
      holdings: input.holdings,
      valuations: input.valuations,
    });
    const fire = input.fireSettings
      ? calculateFireProjection({
          settings: input.fireSettings,
          currentCorpus: portfolio.netWorth,
          monthlyContribution: input.fireSettings.monthlyInvestment ?? 0,
        })
      : null;
    const retirement = calculateRetirementCorpus(input.holdings, input.valuations);
    result.goals = {
      hasData,
      goals: projections.slice(0, 8).map((goal) => ({
        name: goal.name,
        inflatedTarget: goal.inflatedTarget,
        currentFunding: goal.currentFunding,
        gap: goal.gap,
        requiredMonthlySip: goal.requiredMonthlySip,
        status: goal.status,
      })),
      fire: fire
        ? {
            fireNumber: fire.fireNumber,
            currentCorpus: fire.currentCorpus,
            progressPercent: roundToPaise(fire.progress * 100),
            yearsToFire: roundOptional(fire.yearsToFire),
            status: fire.status,
          }
        : null,
      retirementCorpus:
        retirement.rows.length > 0 ||
        retirement.missingValueCount > 0 ||
        retirement.missingFxCount > 0
          ? retirement.total
          : null,
    };
  }

  if (sections.has('tax')) {
    const hasData = Boolean(input.tax);
    if (!hasData) missingSections.push('tax');
    result.tax = {
      hasData,
      financialYear: input.tax?.financialYear ?? null,
      preferredRegime: input.tax?.preferredRegime ?? null,
      taxableIncome: roundOptional(input.tax?.taxableIncome),
      taxPayable: roundOptional(input.tax?.taxPayable),
      monthlyInHand: roundOptional(input.tax?.monthlyInHand),
    };
  }

  result.missingSections = missingSections;
  return FinancialDigestSchema.parse(result);
}
