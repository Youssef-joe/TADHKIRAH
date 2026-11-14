import { z } from 'zod';

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const ReminderCategorySchema = z.enum([
  'prayer',
  'adhkar_morning',
  'adhkar_evening',
  'quran',
  'reflection',
  'weekly_review',
  'custom',
]);
export const ReminderTimingSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fixed'), time: HHMM }),
  z.object({
    type: z.literal('prayer_offset'),
    prayer: z.enum(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']),
    offsetMin: z.number().int().min(-120).max(240),
  }),
]);

export const ReminderRuleSchema = z.object({
  id: z.uuid(),
  category: ReminderCategorySchema,
  timing: ReminderTimingSchema,
  days: z.array(z.number().int().min(0).max(6)).nullable(),
  enabled: z.boolean(),
  allowInQuietHours: z.boolean(),
  customTitle: z.string().nullable(),
});
export type ReminderRuleDto = z.infer<typeof ReminderRuleSchema>;

export const UpdateReminderRuleSchema = z
  .object({
    enabled: z.boolean(),
    timing: ReminderTimingSchema,
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable(),
    allowInQuietHours: z.boolean(),
    customTitle: z.string().trim().min(1).max(120),
  })
  .partial()
  .strict();
export type UpdateReminderRule = z.infer<typeof UpdateReminderRuleSchema>;

export const CreateCustomReminderSchema = z.object({
  customTitle: z.string().trim().min(1).max(120),
  timing: ReminderTimingSchema,
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().default(null),
});

export const NotificationPrefsSchema = z.object({
  enabled: z.boolean(),
  quietStart: HHMM.nullable(),
  quietEnd: HHMM.nullable(),
  dailyCap: z.number().int().min(1).max(20),
});
export type NotificationPrefsDto = z.infer<typeof NotificationPrefsSchema>;

export const PushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  label: z.string().trim().max(80).optional(),
});

export const UpcomingReminderSchema = z.object({
  id: z.uuid(),
  ruleId: z.uuid(),
  category: ReminderCategorySchema,
  fireAt: z.iso.datetime(),
  status: z.enum(['pending', 'suppressed']),
  suppressReason: z.string().nullable(),
});
export type UpcomingReminder = z.infer<typeof UpcomingReminderSchema>;

export const InboxItemSchema = z.object({
  id: z.uuid(),
  scheduledId: z.uuid().nullable(),
  category: ReminderCategorySchema,
  params: z.record(z.string(), z.string()),
  /** Custom reminders: the user's own title (decrypted for them only). */
  customTitle: z.string().nullable(),
  sentAt: z.iso.datetime(),
  openedAt: z.iso.datetime().nullable(),
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

export const SnoozeSchema = z.object({
  minutes: z.union([z.literal(10), z.literal(30), z.literal(60)]),
});
