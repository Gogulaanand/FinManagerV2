import { z } from 'zod';

const Uuid = z.string().uuid();
const IsoTimestamp = z.iso.datetime({ offset: true });

export const DisclosureScopeSchema = z.enum(['existence', 'summary']);
export type DisclosureScope = z.infer<typeof DisclosureScopeSchema>;

export const DeadmanSettingsSchema = z
  .object({
    id: Uuid.optional(),
    userId: Uuid.optional(),
    isEnabled: z.boolean().default(false),
    thresholdDays: z.number().int().min(1).max(365).default(30),
    disclosureNote: z.string().max(5000).nullable().default(null),
    createdAt: IsoTimestamp.nullable().optional(),
    updatedAt: IsoTimestamp.nullable().optional(),
  })
  .strict();
export type DeadmanSettings = z.infer<typeof DeadmanSettingsSchema>;

export const TrustedContactSchema = z
  .object({
    id: Uuid.optional(),
    userId: Uuid.optional(),
    name: z.string().trim().min(1).max(160),
    email: z.email().nullable().default(null),
    phone: z.string().trim().max(40).nullable().default(null),
    relationship: z.string().trim().max(120).nullable().default(null),
    disclosureScope: DisclosureScopeSchema.default('existence'),
    notifyAfterDays: z.number().int().min(1).max(365).default(30),
    priority: z.number().int().min(0).max(100).default(0),
    isActive: z.boolean().default(true),
    createdAt: IsoTimestamp.nullable().optional(),
    updatedAt: IsoTimestamp.nullable().optional(),
  })
  .strict();
export type TrustedContact = z.infer<typeof TrustedContactSchema>;

export const EscalationKindSchema = z.enum([
  'reminder_1',
  'reminder_2',
  'reminder_3',
  'disclosure',
  'cancelled',
  'test',
]);
export type EscalationKind = z.infer<typeof EscalationKindSchema>;

export const EscalationStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type EscalationStatus = z.infer<typeof EscalationStatusSchema>;

export const EscalationEventSchema = z
  .object({
    id: Uuid,
    userId: Uuid,
    kind: EscalationKindSchema,
    status: EscalationStatusSchema,
    recipient: z.string().trim().nullable(),
    detail: z.record(z.string(), z.unknown()).nullable(),
    createdAt: IsoTimestamp,
    sentAt: IsoTimestamp.nullable(),
  })
  .strict();
export type EscalationEvent = z.infer<typeof EscalationEventSchema>;
