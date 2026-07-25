import { z } from 'zod';

import { IsoTimestamp } from './timestamps';

const Uuid = z.string().uuid();
const MonthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const OptionalAmount = z.number().finite().nullable();

export const InsightScopeSchema = z.enum([
  'everything',
  'expenses',
  'budget',
  'portfolio',
  'goals',
  'tax',
]);
export type InsightScope = z.infer<typeof InsightScopeSchema>;

const ExpenseSectionSchema = z
  .object({
    hasData: z.boolean(),
    debit: OptionalAmount,
    credit: OptionalAmount,
    net: OptionalAmount,
    transactionCount: z.number().int().nonnegative(),
    topCategories: z.array(
      z.object({ name: z.string(), amount: z.number().finite(), percentage: z.number().finite() }),
    ),
    monthlyTrend: z.array(
      z.object({ month: MonthKey, debit: z.number().finite(), credit: z.number().finite() }),
    ),
  })
  .strict();

const BudgetSectionSchema = z
  .object({
    hasData: z.boolean(),
    totalBudget: OptionalAmount,
    totalSpent: OptionalAmount,
    overspentCount: z.number().int().nonnegative(),
    categories: z.array(
      z.object({
        name: z.string(),
        budget: z.number().finite(),
        actual: z.number().finite(),
        status: z.enum(['under', 'nearLimit', 'overspent']),
      }),
    ),
  })
  .strict();

const PortfolioSectionSchema = z
  .object({
    hasData: z.boolean(),
    investedValue: OptionalAmount,
    currentValue: OptionalAmount,
    netWorth: OptionalAmount,
    gainLoss: OptionalAmount,
    xirrPercent: OptionalAmount,
    isComplete: z.boolean(),
    missingValueCount: z.number().int().nonnegative(),
    missingFxCount: z.number().int().nonnegative(),
    allocation: z.array(
      z.object({
        assetClass: z.string(),
        value: z.number().finite(),
        percentage: z.number().finite(),
      }),
    ),
    topHoldings: z.array(
      z.object({ name: z.string(), type: z.string(), value: z.number().finite().nullable() }),
    ),
  })
  .strict();

const GoalsSectionSchema = z
  .object({
    hasData: z.boolean(),
    goals: z.array(
      z.object({
        name: z.string(),
        inflatedTarget: z.number().finite(),
        currentFunding: z.number().finite(),
        gap: z.number().finite(),
        requiredMonthlySip: z.number().finite(),
        status: z.enum(['achieved', 'on_track', 'off_track']),
      }),
    ),
    fire: z
      .object({
        fireNumber: z.number().finite(),
        currentCorpus: z.number().finite(),
        progressPercent: z.number().finite(),
        yearsToFire: z.number().finite().nullable(),
        status: z.enum(['achieved', 'on_track', 'off_track']),
      })
      .nullable(),
    retirementCorpus: z.number().finite().nullable(),
  })
  .strict();

const TaxSectionSchema = z
  .object({
    hasData: z.boolean(),
    financialYear: z.string().nullable(),
    preferredRegime: z.string().nullable(),
    taxableIncome: OptionalAmount,
    taxPayable: OptionalAmount,
    monthlyInHand: OptionalAmount,
  })
  .strict();

export const FinancialDigestSchema = z
  .object({
    version: z.literal(1),
    scope: InsightScopeSchema,
    month: MonthKey,
    generatedAt: IsoTimestamp,
    expenses: ExpenseSectionSchema.optional(),
    budget: BudgetSectionSchema.optional(),
    portfolio: PortfolioSectionSchema.optional(),
    goals: GoalsSectionSchema.optional(),
    tax: TaxSectionSchema.optional(),
    missingSections: z.array(z.enum(['expenses', 'budget', 'portfolio', 'goals', 'tax'])),
  })
  .strict();
export type FinancialDigest = z.infer<typeof FinancialDigestSchema>;

export const ChatMessageSchema = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1) })
  .strict();
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AiSummarySchema = z
  .object({
    id: Uuid.optional(),
    userId: Uuid.optional(),
    month: MonthKey,
    scope: InsightScopeSchema.default('everything'),
    content: z.string().trim().min(1),
    generatedAt: IsoTimestamp,
  })
  .strict();
export type AiSummary = z.infer<typeof AiSummarySchema>;

export const AiInsightsRequestSchema = z
  .object({
    mode: z.enum(['chat', 'monthly_summary']),
    scope: InsightScopeSchema,
    question: z.string().trim().min(1).optional(),
    digest: FinancialDigestSchema,
    history: z.array(ChatMessageSchema).max(10).default([]),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.mode === 'chat' && !request.question) {
      context.addIssue({
        code: 'custom',
        path: ['question'],
        message: 'A question is required for chat requests',
      });
    }
  });
export type AiInsightsRequest = z.infer<typeof AiInsightsRequestSchema>;

export const AiInsightsErrorSchema = z
  .object({
    error: z.enum(['unauthorized', 'budget_exceeded', 'offline', 'invalid_request', 'upstream']),
    message: z.string().min(1),
  })
  .strict();
export type AiInsightsError = z.infer<typeof AiInsightsErrorSchema>;
