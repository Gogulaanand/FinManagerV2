export {
  DEFAULT_EXPECTED_RETURN,
  DEFAULT_INFLATION,
  calculateGoalProjection,
  calculateGoalProjections,
  requiredMonthlySip,
  sumLinkedHoldingValue,
} from './goals.js';
export type {
  GoalProjection,
  GoalProjectionOptions,
  GoalStatus,
  LinkedHoldingValue,
} from './goals.js';
export {
  DEFAULT_FAT_MULTIPLIER,
  DEFAULT_FIRE_EXPECTED_RETURN,
  DEFAULT_FIRE_INFLATION,
  DEFAULT_LEAN_MULTIPLIER,
  DEFAULT_WITHDRAWAL_RATE,
  calculateFireProjection,
  averageMonthlySavings,
  monthlyExpenseTotals,
  suggestAnnualExpenses,
  swrMultiplier,
} from './fire.js';
export type {
  FireProjection,
  FireProjectionInput,
  FireStatus,
  FireVariant,
  FireVariantKey,
} from './fire.js';
export { RETIREMENT_HOLDING_TYPES, calculateRetirementCorpus } from './retirement.js';
export type {
  RetirementCorpus,
  RetirementCorpusByType,
  RetirementCorpusOptions,
  RetirementCorpusRow,
} from './retirement.js';
export { growthFactor, todayIso, yearsBetween } from './time.js';
