import { z } from 'zod';

import { DirectionSchema, TransactionSchema } from './expenses';
import type { Direction } from './expenses';

export const CsvFieldSchema = z.enum([
  'date',
  'description',
  'merchant',
  'amount',
  'debit',
  'credit',
  'category',
]);
export type CsvField = z.infer<typeof CsvFieldSchema>;

export const CsvMappingSchema = z.object({
  bankKey: z.string().trim().min(1),
  columns: z.record(z.string(), CsvFieldSchema),
  defaultCategoryId: z.string().uuid().nullable().default(null),
});
export type CsvMapping = z.infer<typeof CsvMappingSchema>;

export const CsvMappingSetSchema = z.object({
  mappings: z.array(CsvMappingSchema),
});
export type CsvMappingSet = z.infer<typeof CsvMappingSetSchema>;

export const CsvImportRowSchema = TransactionSchema.pick({
  accountId: true,
  categoryId: true,
  amount: true,
  direction: true,
  currency: true,
  occurredOn: true,
  note: true,
  merchant: true,
  importHash: true,
}).extend({
  sourceRow: z.number().int().nonnegative(),
  error: z.string().nullable().default(null),
});
export type CsvImportRow = z.infer<typeof CsvImportRowSchema>;

export { DirectionSchema };
export type { Direction };
