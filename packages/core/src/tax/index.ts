export { computeTax, slabTax, taxOnTaxableIncome } from './compute.js';
export type {
  ChapterViABreakdown,
  DeductionsInput,
  RegimeResult,
  SlabCharge,
  TaxCharge,
  TaxComparison,
  TaxInput,
} from './compute.js';
export { AVAILABLE_FYS, DEFAULT_FY, RULES, rulesFor } from './rules.js';
export type {
  AgeBand,
  DeductionCaps,
  FinancialYearRules,
  RebateRule,
  Regime,
  RegimeRules,
  Slab,
  SurchargeTier,
} from './rules.js';
export { decomposeSalary, hraExemption, SALARY_DEFAULTS } from './salary.js';
export type {
  CityClass,
  HraExemption,
  HraExemptionInput,
  SalaryStructure,
  SalaryStructureInput,
} from './salary.js';
