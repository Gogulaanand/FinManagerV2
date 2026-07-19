export { roundToPaise } from './money.js';
export { directionOf, formatChoiceLabel, formatDelta, formatInr } from './format.js';
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
  expandOccurrences,
  parseCsv,
  previewCsv,
  reduceKeypad,
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
  calculateGoalProjection,
  calculateGoalProjections,
  calculateRetirementCorpus,
  growthFactor,
  requiredMonthlySip,
  suggestAnnualExpenses,
  sumLinkedHoldingValue,
  todayIso,
  yearsBetween,
} from './goals/index.js';
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
