export { roundToPaise } from './money.js';
export {
  budgetRatio,
  directionOf,
  formatChoiceLabel,
  formatDelta,
  formatInr,
  formatPercent,
  percentToRatio,
  ratioToPercent,
} from './format.js';
export type { Direction, FormatInrOptions } from './format.js';

export { computeTax, slabTax, taxOnTaxableIncome } from './tax/compute.js';
export type {
  ChapterViABreakdown,
  DeductionsInput,
  RegimeResult,
  SlabCharge,
  TaxCharge,
  TaxComparison,
  TaxInput,
} from './tax/compute.js';
export { AVAILABLE_FYS, DEFAULT_FY, RULES, rulesFor } from './tax/rules.js';
export type {
  AgeBand,
  DeductionCaps,
  FinancialYearRules,
  RebateRule,
  Regime,
  RegimeRules,
  Slab,
  SurchargeTier,
} from './tax/rules.js';
export { decomposeSalary, hraExemption, SALARY_DEFAULTS } from './tax/salary.js';
export type {
  CityClass,
  HraExemption,
  HraExemptionInput,
  SalaryStructure,
  SalaryStructureInput,
} from './tax/salary.js';

export {
  DEFAULT_CATEGORIES,
  canonicalImportHash,
  buildBudgetVsActual,
  buildMonthlyTrend,
  calculateBudgetProgress,
  calculateCategoryBreakdown,
  calculateMonthlySummary,
  endOfMonthDate,
  monthRange,
  clampMonth,
  monthLabel,
  monthNow,
  shiftMonth,
  expandOccurrences,
  parseCsv,
  previewCsv,
  reduceKeypad,
  trendWindowStart,
} from './expenses/index.js';
export type {
  BudgetChartPoint,
  BudgetProgress,
  BudgetStatus,
  CategoryBreakdown,
  CsvDocument,
  CsvImportPreview,
  CsvPreviewError,
  DefaultCategory,
  ExpandedOccurrence,
  MonthlySummary,
  MonthlyTrendPoint,
  RecurrenceExpansionInput,
} from './expenses/index.js';
export type { KeypadAction } from './expenses/index.js';
export {
  EVENT_KIND_LABELS,
  allowedEventKinds,
  mergeHoldingTimeline,
  showsQuantityPrice,
} from './portfolio-ux.js';
export type { HoldingTimelineEntry } from './portfolio-ux.js';
export {
  assetClassForType,
  buildHoldingCashFlows,
  calculatePortfolioSummary,
  calculateXirr,
  canonicalPortfolioImportHash,
  effectiveHoldingValue,
  fxRateToInrForCurrency,
  latestValuation,
  normalizeCashFlowsToInr,
  valuationValueInr,
  parsePortfolioCsv,
  YahooFinanceQuoteProvider,
} from './portfolio/index.js';
export type {
  AllocationRow,
  AssetClass,
  EffectiveValue,
  HoldingCashFlow,
  HoldingXirr,
  NormalizedCashFlows,
  PortfolioSummary,
  XirrCashFlow,
  XirrOptions,
  XirrResult,
  PortfolioImportPreview,
  PortfolioImportPreviewError,
  PortfolioImportPreviewRow,
  PriceQuoteProvider,
  QuoteRefreshResult,
  QuoteRefreshStatus,
} from './portfolio/index.js';

export {
  DEFAULT_EXPECTED_RETURN,
  DEFAULT_FAT_MULTIPLIER,
  DEFAULT_FIRE_EXPECTED_RETURN,
  DEFAULT_FIRE_INFLATION,
  DEFAULT_INFLATION,
  DEFAULT_LEAN_MULTIPLIER,
  DEFAULT_WITHDRAWAL_RATE,
  RETIREMENT_HOLDING_TYPES,
  calculateFireProjection,
  averageMonthlySavings,
  monthlyExpenseTotals,
  calculateGoalProjection,
  calculateGoalProjections,
  calculateRetirementCorpus,
  growthFactor,
  requiredMonthlySip,
  suggestAnnualExpenses,
  swrMultiplier,
  sumLinkedHoldingValue,
  todayIso,
  yearsBetween,
} from './goals/index.js';
export { buildFinancialDigest } from './insights/index.js';
export { createAnthropicSseParser } from './insights/index.js';
export type {
  AnthropicSseParser,
  BuildFinancialDigestInput,
  TaxDigestInput,
} from './insights/index.js';
export type {
  FireProjection,
  FireProjectionInput,
  FireStatus,
  FireVariant,
  FireVariantKey,
  GoalProjection,
  GoalProjectionOptions,
  GoalStatus,
  LinkedHoldingValue,
  RetirementCorpus,
  RetirementCorpusByType,
  RetirementCorpusOptions,
  RetirementCorpusRow,
} from './goals/index.js';

export {
  STAGE_OFFSETS,
  buildDisclosureMessage,
  buildReminderMessage,
  buildSummary,
  daysUntilNextStage,
  describeDays,
  presentableSummary,
  summaryLabel,
} from './deadman/messages.js';
export type {
  DisclosureScope,
  EmailMessage,
  EscalationStage,
  SummaryEntry,
} from './deadman/messages.js';

export { selectRecentActivity, spendChangeRatio } from './dashboard/recent.js';
export type { RecentActivityRow } from './dashboard/recent.js';
