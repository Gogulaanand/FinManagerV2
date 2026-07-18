import { z } from 'zod';

import { CurrencyCodeSchema } from './money';

const Uuid = z.string().uuid();
const IsoDate = z.iso.date();
const NonNegative = z.number().finite().nonnegative();

export const HoldingTypeSchema = z.enum([
  'mutual_fund',
  'stock',
  'foreign_stock',
  'rsu',
  'esop',
  'epf',
  'ppf',
  'nps',
  'fd',
  'real_estate',
  'gold',
  'crypto',
  'cash',
]);
export type HoldingType = z.infer<typeof HoldingTypeSchema>;

const VestTrancheSchema = z
  .object({
    date: IsoDate,
    quantity: z.number().finite().positive(),
    vested: z.boolean().default(false),
  })
  .strict();

const RsuEsopMetadataSchema = z
  .object({
    kind: z.enum(['rsu', 'esop']),
    grantDate: IsoDate,
    grantPrice: NonNegative,
    sourceCurrency: CurrencyCodeSchema,
    vestSchedule: z.array(VestTrancheSchema).min(1),
  })
  .strict();

const RealEstateMetadataSchema = z
  .object({
    kind: z.literal('real_estate'),
    purchaseDate: IsoDate.nullable().default(null),
    location: z.string().trim().min(1),
    areaSqFt: NonNegative.nullable().default(null),
    valuationSource: z.string().trim().min(1).nullable().default(null),
  })
  .strict();

const RetirementMetadataSchema = z
  .object({
    kind: z.enum(['epf', 'ppf', 'nps']),
    accountNumberMasked: z.string().trim().min(1).nullable().default(null),
    employer: z.string().trim().min(1).nullable().default(null),
    annualInterestRate: z.number().finite().min(0).max(100).nullable().default(null),
    lastUpdatedOn: IsoDate.nullable().default(null),
  })
  .strict();

export const HoldingMetadataSchema = z.union([
  RsuEsopMetadataSchema,
  RealEstateMetadataSchema,
  RetirementMetadataSchema,
]);
export type HoldingMetadata = z.infer<typeof HoldingMetadataSchema>;

const HoldingFields = {
  id: Uuid.optional(),
  userId: Uuid.optional(),
  name: z.string().trim().min(1),
  type: HoldingTypeSchema,
  identifier: z.string().trim().min(1).nullable().default(null),
  accountId: Uuid.nullable().default(null),
  currency: CurrencyCodeSchema.default('INR'),
  quantity: NonNegative.default(0),
  avgCost: NonNegative.nullable().default(null),
  currentPrice: NonNegative.nullable().default(null),
  currentValue: NonNegative.nullable().default(null),
  manualPriceOverride: NonNegative.nullable().default(null),
  manualValueOverride: NonNegative.nullable().default(null),
  manualFxRateToInr: z.number().finite().positive().nullable().default(null),
  automaticPrice: NonNegative.nullable().default(null),
  automaticPriceAsOf: IsoDate.nullable().default(null),
  automaticPriceSource: z.string().trim().min(1).nullable().default(null),
  automaticPriceProvider: z.string().trim().min(1).nullable().default(null),
  automaticPriceFxRateToInr: z.number().finite().positive().nullable().default(null),
  metadata: HoldingMetadataSchema.nullable().default(null),
  isActive: z.boolean().default(true),
};

export const HoldingSchema = z
  .object(HoldingFields)
  .strict()
  .superRefine((value, context) => {
    const specialTypes = new Set(['rsu', 'esop', 'real_estate', 'epf', 'ppf', 'nps']);
    if (specialTypes.has(value.type) && !value.metadata) {
      context.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: 'Metadata is required for this holding type',
      });
    }
    if (value.type === 'rsu' || value.type === 'esop') {
      if (!value.metadata || value.metadata.kind !== value.type) {
        context.addIssue({
          code: 'custom',
          path: ['metadata', 'kind'],
          message: 'Metadata kind must match holding type',
        });
      }
    } else if (value.type === 'real_estate') {
      if (!value.metadata || value.metadata.kind !== 'real_estate') {
        context.addIssue({
          code: 'custom',
          path: ['metadata', 'kind'],
          message: 'Metadata kind must match holding type',
        });
      }
    } else if (value.type === 'epf' || value.type === 'ppf' || value.type === 'nps') {
      if (!value.metadata || value.metadata.kind !== value.type) {
        context.addIssue({
          code: 'custom',
          path: ['metadata', 'kind'],
          message: 'Metadata kind must match holding type',
        });
      }
    } else if (value.metadata) {
      context.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: 'Metadata kind must match holding type',
      });
    }
  });
export type Holding = z.infer<typeof HoldingSchema>;

export const HoldingEventKindSchema = z.enum([
  'buy',
  'sell',
  'vest',
  'exercise',
  'dividend',
  'interest',
  'contribution',
  'withdrawal',
]);
export type HoldingEventKind = z.infer<typeof HoldingEventKindSchema>;

const EventFields = {
  id: Uuid.optional(),
  userId: Uuid.optional(),
  holdingId: Uuid,
  kind: HoldingEventKindSchema,
  occurredOn: IsoDate,
  quantity: z.number().finite().positive().nullable().default(null),
  price: z.number().finite().positive().nullable().default(null),
  amount: z.number().finite(),
  currency: CurrencyCodeSchema.default('INR'),
  fxRateToInr: z.number().finite().positive().nullable().default(null),
  note: z.string().trim().min(1).nullable().default(null),
  importHash: z.string().trim().min(1).nullable().default(null),
};

function enforceEventSign(
  value: {
    readonly kind: HoldingEventKind;
    readonly amount: number;
    readonly currency?: string;
    readonly fxRateToInr?: number | null;
  },
  context: z.RefinementCtx,
): void {
  const negativeKinds = new Set(['buy', 'contribution', 'exercise']);
  const positiveKinds = new Set(['sell', 'dividend', 'interest', 'withdrawal']);
  if (value.kind === 'vest' && value.amount !== 0) {
    context.addIssue({
      code: 'custom',
      path: ['amount'],
      message: 'Vest is a non-cash event and must have a zero amount',
    });
  } else if (negativeKinds.has(value.kind) && value.amount >= 0) {
    context.addIssue({
      code: 'custom',
      path: ['amount'],
      message: 'This event kind must be a negative investor cash flow',
    });
  } else if (positiveKinds.has(value.kind) && value.amount <= 0) {
    context.addIssue({
      code: 'custom',
      path: ['amount'],
      message: 'This event kind must be a positive investor cash flow',
    });
  }
  if (value.currency && value.currency !== 'INR' && !(value.fxRateToInr && value.fxRateToInr > 0)) {
    context.addIssue({
      code: 'custom',
      path: ['fxRateToInr'],
      message: 'Non-INR events require a positive dated FX rate to INR',
    });
  }
}

export const HoldingEventSchema = z.object(EventFields).strict().superRefine(enforceEventSign);
export type HoldingEvent = z.infer<typeof HoldingEventSchema>;

export const ValuationSchema = z
  .object({
    id: Uuid.optional(),
    userId: Uuid.optional(),
    holdingId: Uuid,
    asOf: IsoDate,
    value: z.number().finite().positive(),
    currency: CurrencyCodeSchema.default('INR'),
    fxRateToInr: z.number().finite().positive().nullable().default(null),
    source: z.string().trim().min(1).nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.currency !== 'INR' && !(value.fxRateToInr && value.fxRateToInr > 0)) {
      context.addIssue({
        code: 'custom',
        path: ['fxRateToInr'],
        message: 'Non-INR valuations require a positive dated FX rate to INR',
      });
    }
  });
export type Valuation = z.infer<typeof ValuationSchema>;

export const QuoteSchema = z
  .object({
    holdingId: Uuid,
    price: z.number().finite().positive(),
    asOf: IsoDate,
    currency: CurrencyCodeSchema,
    fxRateToInr: z.number().finite().positive().nullable().default(null),
    source: z.string().trim().min(1),
    provider: z.string().trim().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.currency !== 'INR' && !(value.fxRateToInr && value.fxRateToInr > 0)) {
      context.addIssue({
        code: 'custom',
        path: ['fxRateToInr'],
        message: 'Non-INR quotes require a positive FX rate to INR',
      });
    }
  });
export type Quote = z.infer<typeof QuoteSchema>;

export const PortfolioImportSourceSchema = z.enum(['zerodha', 'cams', 'kfintech']);
export type PortfolioImportSource = z.infer<typeof PortfolioImportSourceSchema>;

export const PortfolioImportRowSchema = z
  .object({
    source: PortfolioImportSourceSchema,
    accountId: Uuid.nullable().default(null),
    name: z.string().trim().min(1),
    type: HoldingTypeSchema,
    identifier: z.string().trim().min(1).nullable().default(null),
    currency: CurrencyCodeSchema.default('INR'),
    occurredOn: IsoDate,
    kind: HoldingEventKindSchema,
    quantity: z.number().finite().positive().nullable().default(null),
    price: z.number().finite().positive().nullable().default(null),
    amount: z.number().finite(),
    fxRateToInr: z.number().finite().positive().nullable().default(null),
    note: z.string().trim().min(1).nullable().default(null),
    importHash: z.string().trim().min(1),
  })
  .strict()
  .superRefine(enforceEventSign);
export type PortfolioImportRow = z.infer<typeof PortfolioImportRowSchema>;
