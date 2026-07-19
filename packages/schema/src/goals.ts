import { z } from 'zod';

const Uuid = z.string().uuid();
const IsoDate = z.iso.date();
const NonNegative = z.number().finite().nonnegative();
const Percentage = z.number().finite().min(0).max(100);

export const GoalKindSchema = z.enum([
  'education',
  'foreign_studies',
  'marriage',
  'retirement',
  'custom',
]);
export type GoalKind = z.infer<typeof GoalKindSchema>;

export const GoalSchema = z
  .object({
    id: Uuid.optional(),
    userId: Uuid.optional(),
    name: z.string().trim().min(1),
    kind: GoalKindSchema,
    // Target cost expressed in today's rupees; the goal engine inflates it to the target date.
    targetAmount: NonNegative,
    targetDate: IsoDate.nullable().default(null),
    // Amount already earmarked for this goal outside of any linked holdings.
    currentAmount: NonNegative.default(0),
    // Annual expected return and inflation, as whole percentages (e.g. 12 for 12%).
    expectedReturn: Percentage.nullable().default(null),
    inflation: Percentage.nullable().default(null),
    linkedHoldingIds: z.array(Uuid).default([]),
    notes: z.string().trim().min(1).nullable().default(null),
  })
  .strict();
export type Goal = z.infer<typeof GoalSchema>;

export const FireSettingsSchema = z
  .object({
    id: Uuid.optional(),
    userId: Uuid.optional(),
    // Annual expenses baseline in today's rupees; auto-suggested from Phase 4 data.
    annualExpenses: NonNegative.nullable().default(null),
    // Safe withdrawal rate as a whole percentage (default 4% -> 25x expenses).
    withdrawalRate: z.number().finite().positive().max(100).default(4),
    expectedReturn: Percentage.nullable().default(null),
    inflation: Percentage.nullable().default(null),
    currentAge: z.number().int().min(0).max(120).nullable().default(null),
    retirementAge: z.number().int().min(0).max(120).nullable().default(null),
    // Lean/fat FIRE corpus multipliers relative to the regular FIRE number.
    leanMultiplier: z.number().finite().positive().nullable().default(null),
    fatMultiplier: z.number().finite().positive().nullable().default(null),
    // Amount invested each month toward FIRE, in today's rupees. When null the
    // app falls back to the savings rate derived from recent transactions.
    monthlyInvestment: NonNegative.nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.currentAge !== null &&
      value.retirementAge !== null &&
      value.retirementAge < value.currentAge
    ) {
      context.addIssue({
        code: 'custom',
        path: ['retirementAge'],
        message: 'Retirement age cannot be before the current age',
      });
    }
    if (
      value.leanMultiplier !== null &&
      value.fatMultiplier !== null &&
      value.fatMultiplier < value.leanMultiplier
    ) {
      context.addIssue({
        code: 'custom',
        path: ['fatMultiplier'],
        message: 'Fat multiplier cannot be below the lean multiplier',
      });
    }
  });
export type FireSettings = z.infer<typeof FireSettingsSchema>;
