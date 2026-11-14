import { z } from 'zod';
import { LocalDateSchema } from './common.js';

export const CategorySchema = z.enum([
  'obligatory_prayer',
  'voluntary_prayer',
  'adhkar',
  'quran',
  'fasting',
  'custom',
]);
export const MeasureSchema = z.enum(['prayer_status', 'boolean', 'count']);
export const UnitSchema = z.enum(['pages', 'rakah', 'prayers', 'times']);
export const PrayerStatusSchema = z.enum(['on_time', 'later', 'qada', 'excused']);

export const ScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({
    type: z.literal('weekdays'),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
  z.object({ type: z.literal('times_per_week'), n: z.number().int().min(1).max(7) }),
]);
export type ScheduleDto = z.infer<typeof ScheduleSchema>;

export const ActivitySchema = z.object({
  id: z.uuid(),
  catalogKey: z.string().nullable(),
  name: z.string().nullable(),
  category: CategorySchema,
  obligation: z.enum(['obligatory', 'voluntary']),
  measure: MeasureSchema,
  unit: UnitSchema.nullable(),
  max: z.number().nullable(),
  schedule: ScheduleSchema,
  dailyTarget: z.number().nullable(),
  enabled: z.boolean(),
  sort: z.number().int(),
});
export type ActivityDto = z.infer<typeof ActivitySchema>;

export const CreateCustomActivitySchema = z.object({
  name: z.string().trim().min(1).max(60),
  measure: z.enum(['boolean', 'count']),
  unit: UnitSchema.nullable().default(null),
  schedule: ScheduleSchema.default({ type: 'daily' }),
  dailyTarget: z.number().positive().max(10_000).nullable().default(null),
});
export type CreateCustomActivity = z.input<typeof CreateCustomActivitySchema>;

export const UpdateActivitySchema = z
  .object({
    enabled: z.boolean(),
    schedule: ScheduleSchema,
    dailyTarget: z.number().positive().max(10_000).nullable(),
    name: z.string().trim().min(1).max(60),
  })
  .partial()
  .strict();
export type UpdateActivity = z.infer<typeof UpdateActivitySchema>;

export const ReorderActivitiesSchema = z.object({ ids: z.array(z.uuid()).min(1).max(200) });

export const LogSchema = z.object({
  id: z.uuid(),
  activityId: z.uuid(),
  localDate: LocalDateSchema,
  prayerStatus: PrayerStatusSchema.nullable(),
  done: z.boolean().nullable(),
  amount: z.number().nullable(),
  clientUpdatedAt: z.iso.datetime(),
});
export type LogDto = z.infer<typeof LogSchema>;

/** Exactly one value, matching the activity's measure (checked by the API). */
export const UpsertLogSchema = z
  .object({
    id: z.uuid(),
    prayerStatus: PrayerStatusSchema.optional(),
    done: z.boolean().optional(),
    amount: z.number().min(0).max(10_000).optional(),
    clientUpdatedAt: z.iso.datetime(),
  })
  .refine(
    (v) => [v.prayerStatus, v.done, v.amount].filter((x) => x !== undefined).length === 1,
    'Provide exactly one of prayerStatus, done or amount',
  );
export type UpsertLog = z.infer<typeof UpsertLogSchema>;

export const DayFlagsSchema = z.object({
  excused: z.boolean(),
  travelling: z.boolean(),
});
export type DayFlagsDto = z.infer<typeof DayFlagsSchema>;

export const LogsQuerySchema = z.object({ from: LocalDateSchema, to: LocalDateSchema });

export const LogsResponseSchema = z.object({
  /** The current tracking day for this user (ADR-001), so clients agree with the server. */
  today: LocalDateSchema,
  backfillDays: z.number().int(),
  logs: z.array(LogSchema),
  flags: z.array(DayFlagsSchema.extend({ localDate: LocalDateSchema })),
});
export type LogsResponse = z.infer<typeof LogsResponseSchema>;
