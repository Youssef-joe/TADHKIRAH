import { sql } from 'drizzle-orm';
import { check, pgSchema, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
