import { z } from 'zod';
import { TimeZoneSchema } from './auth.js';
import { LocalDateSchema, LocaleSchema } from './common.js';

/** Must match `CALCULATION_METHODS` in @tadhkirah/domain (a type check in the API enforces this). */
export const CalculationMethodSchema = z.enum([
  'MuslimWorldLeague',
  'Egyptian',
  'Karachi',
  'UmmAlQura',
  'Dubai',
  'Qatar',
  'Kuwait',
  'MoonsightingCommittee',
  'NorthAmerica',
  'Singapore',
  'Turkey',
  'Tehran',
]);
export const AsrMethodSchema = z.enum(['standard', 'hanafi']);
export const HighLatRuleSchema = z.enum(['middle_of_night', 'seventh_of_night', 'twilight_angle']);
export const PrayerNameSchema = z.enum(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']);

const minutes = z.number().int().min(-30).max(30);

export const PrayerSettingsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationLabel: z.string().trim().min(1).max(80),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .default(null),
  method: CalculationMethodSchema,
  asrMethod: AsrMethodSchema.default('standard'),
  highLatRule: HighLatRuleSchema.nullable().default(null),
  adjustments: z.partialRecord(PrayerNameSchema, minutes).default({}),
  jumuahKhutbahTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
});
export type PrayerSettings = z.infer<typeof PrayerSettingsSchema>;
export type PrayerSettingsInput = z.input<typeof PrayerSettingsSchema>;

export const OnboardingRequestSchema = z.object({
  locale: LocaleSchema.optional(),
  timezone: TimeZoneSchema,
  prayerSettings: PrayerSettingsSchema,
});
export type OnboardingRequest = z.input<typeof OnboardingRequestSchema>;

export const PrayerTimesQuerySchema = z.object({
  from: LocalDateSchema.optional(),
  to: LocalDateSchema.optional(),
});

const Instant = z.iso.datetime();
const Window = z.object({ start: Instant, end: Instant });

export const PrayerDaySchema = z.object({
  date: LocalDateSchema,
  hijri: z.object({ year: z.number(), month: z.number(), day: z.number() }),
  times: z.record(PrayerNameSchema, Instant),
  windows: z.object({
    lastThirdOfNight: Window,
    afterAsrUntilMaghrib: Window,
    jumuah: Window.optional(),
  }),
});

export const PrayerTimesResponseSchema = z.object({
  timeZone: z.string(),
  /** The current tracking day (starts at Fajr, ADR-001). */
  today: LocalDateSchema,
  days: z.array(PrayerDaySchema),
});
export type PrayerTimesResponse = z.infer<typeof PrayerTimesResponseSchema>;
