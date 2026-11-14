import { sql } from 'drizzle-orm';
import {
  check,
  jsonb,
  numeric,
  pgSchema,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

/**
 * Private user data. Every table here has row-level security: rows are visible
 * only when `app.user_id` matches and the transaction runs as the
 * `tadhkirah_app` role. The policies are in the custom migration
 * `0002_app_rls.sql`, and queries go through `withUser()`.
 */
export const app = pgSchema('app');

export const localeEnum = app.enum('locale', ['ar', 'en']);
export const digitsEnum = app.enum('digits', ['arab', 'latn']);
export const themeEnum = app.enum('theme', ['system', 'light', 'dark']);

const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

export const userProfiles = app.table('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  locale: localeEnum('locale').notNull().default('ar'),
  digits: digitsEnum('digits').notNull().default('arab'),
  /** IANA timezone, validated by the API. */
  timezone: text('timezone').notNull().default('Asia/Riyadh'),
  /** Set when the user finishes onboarding (location + calculation method). */
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt,
});

export const userPreferences = app.table(
  'user_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 0 = Sunday … 6 = Saturday. Saturday by default (ADR-002). */
    weekStart: smallint('week_start').notNull().default(6),
    hijriOffset: smallint('hijri_offset').notNull().default(0),
    backfillDays: smallint('backfill_days').notNull().default(7),
    theme: themeEnum('theme').notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt,
  },
  (t) => [
    check('user_preferences_week_start_ck', sql`${t.weekStart} between 0 and 6`),
    check('user_preferences_hijri_offset_ck', sql`${t.hijriOffset} between -2 and 2`),
    check('user_preferences_backfill_days_ck', sql`${t.backfillDays} between 0 and 30`),
  ],
);

export const asrMethodEnum = app.enum('asr_method', ['standard', 'hanafi']);
export const highLatRuleEnum = app.enum('high_lat_rule', [
  'middle_of_night',
  'seventh_of_night',
  'twilight_angle',
]);

/**
 * Where and how the user's prayer times are calculated (M2). Coordinates are
 * rounded to 2 decimals (~1 km) before storage: precise enough for prayer
 * times, but not a home address.
 */
export const prayerTimeSettings = app.table(
  'prayer_time_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    latitude: numeric('latitude', { precision: 7, scale: 2, mode: 'number' }).notNull(),
    longitude: numeric('longitude', { precision: 7, scale: 2, mode: 'number' }).notNull(),
    locationLabel: text('location_label').notNull(),
    countryCode: text('country_code'),
    /** adhan calculation method key, validated against the domain list by the API. */
    method: text('method').notNull(),
    asrMethod: asrMethodEnum('asr_method').notNull().default('standard'),
    highLatRule: highLatRuleEnum('high_lat_rule'),
    /** Per-prayer minute adjustments, e.g. {"fajr": 2}. */
    adjustments: jsonb('adjustments').$type<Record<string, number>>().notNull().default({}),
    jumuahKhutbahTime: time('jumuah_khutbah_time'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check('prayer_lat_ck', sql`${t.latitude} between -90 and 90`),
    check('prayer_lng_ck', sql`${t.longitude} between -180 and 180`),
  ],
);
