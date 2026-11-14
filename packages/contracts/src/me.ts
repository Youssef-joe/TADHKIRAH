import { z } from 'zod';
import { TimeZoneSchema } from './auth.js';
import { LocaleSchema } from './common.js';
import { PrayerSettingsSchema } from './prayer.js';

export const DigitsSchema = z.enum(['arab', 'latn']);
export const ThemeSchema = z.enum(['system', 'light', 'dark']);

export const ProfileSchema = z.object({
  displayName: z.string().nullable(),
  locale: LocaleSchema,
  digits: DigitsSchema,
  timezone: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const PreferencesSchema = z.object({
  weekStart: z.number().int().min(0).max(6),
  hijriOffset: z.number().int().min(-2).max(2),
  backfillDays: z.number().int().min(0).max(30),
  theme: ThemeSchema,
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const MeResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  profile: ProfileSchema,
  preferences: PreferencesSchema,
  /** Null until the user picks a location (onboarding). */
  prayerSettings: PrayerSettingsSchema.nullable(),
  onboarded: z.boolean(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const UpdateProfileRequestSchema = z
  .object({
    displayName: z.string().trim().max(60).nullable(),
    locale: LocaleSchema,
    digits: DigitsSchema,
    timezone: TimeZoneSchema,
  })
  .partial()
  .strict();
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UpdatePreferencesRequestSchema = PreferencesSchema.partial().strict();
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;
