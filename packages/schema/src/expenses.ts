import { z } from 'zod';

import { CurrencyCodeSchema } from './money';

const PositiveMoneySchema = z.number().finite().positive();

export const DirectionSchema = z.enum(['debit', 'credit']);
export type Direction = z.infer<typeof DirectionSchema>;

export const AccountTypeSchema = z.enum(['bank', 'broker', 'wallet', 'cash', 'credit_card']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CategoryKindSchema = z.enum(['expense', 'income', 'transfer']);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const RecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
export type RecurrenceFrequency = z.infer<typeof RecurrenceFrequencySchema>;

export const AccountSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  type: AccountTypeSchema,
  institution: z.string().nullable().default(null),
  currency: CurrencyCodeSchema.default('INR'),
  currentBalance: z.number().finite(),
  isActive: z.boolean().default(true),
});
export type Account = z.infer<typeof AccountSchema>;

export const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  kind: CategoryKindSchema,
  icon: z.string().nullable().default(null),
  color: z.string().nullable().default(null),
  parentId: z.string().uuid().nullable().default(null),
  isSystem: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type Category = z.infer<typeof CategorySchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  accountId: z.string().uuid().nullable().default(null),
  categoryId: z.string().uuid().nullable().default(null),
  amount: PositiveMoneySchema,
  direction: DirectionSchema,
  currency: CurrencyCodeSchema.default('INR'),
  occurredOn: z.iso.date(),
  note: z.string().nullable().default(null),
  merchant: z.string().nullable().default(null),
  isRecurring: z.boolean().default(false),
  recurringId: z.string().uuid().nullable().default(null),
  recurrenceFrequency: RecurrenceFrequencySchema.nullable().default(null),
  recurrenceInterval: z.number().int().positive().default(1),
  recurrenceEndOn: z.iso.date().nullable().default(null),
  recurrenceGeneratedThrough: z.iso.date().nullable().default(null),
  importHash: z.string().nullable().default(null),
  occurrenceKey: z.string().nullable().default(null),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const BudgetSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().default(null),
  period: z.literal('monthly').default('monthly'),
  periodStart: z
    .iso
    .date()
    .refine((value) => value.endsWith('-01'), 'Budget period must start on the first day'),
  amount: PositiveMoneySchema,
});
export type Budget = z.infer<typeof BudgetSchema>;

export const RecurrenceRuleSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  interval: z.number().int().positive().default(1),
  endOn: z.iso.date().nullable().default(null),
});
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;
