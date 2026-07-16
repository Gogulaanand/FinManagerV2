import { z } from 'zod';

/** ISO 4217 codes the app handles. INR is the reporting currency. */
export const CurrencyCodeSchema = z.enum(['INR', 'USD', 'EUR', 'GBP']);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** A monetary amount stored as a decimal in major units (rupees, not paise). */
export const MoneySchema = z.object({
  amount: z.number().finite(),
  currency: CurrencyCodeSchema.default('INR'),
});
export type Money = z.infer<typeof MoneySchema>;
