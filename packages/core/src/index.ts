export { roundToPaise } from './money.js';
export { directionOf, formatDelta, formatInr } from './format.js';
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
  expandOccurrences,
  parseCsv,
  previewCsv,
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
