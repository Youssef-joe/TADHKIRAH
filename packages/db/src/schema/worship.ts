import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { app } from './app.js';
import { users } from './auth.js';

export const obligationEnum = app.enum('obligation', ['obligatory', 'voluntary']);
export const measureEnum = app.enum('measure', ['prayer_status', 'boolean', 'count']);
export const prayerStatusEnum = app.enum('prayer_status', ['on_time', 'later', 'qada', 'excused']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * The user's worship activities (M3): one row per built-in catalog activity
 * (`catalog_key`, provisioned on first use) plus the user's own custom
 * activities (`catalog_key` NULL, always voluntary).
 */
export const userActivities = app.table(
  'user_activities',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    catalogKey: text('catalog_key'),
    /** Custom activities only. Plain user text: not a reflection, so not encrypted. */
    name: text('name'),
    category: text('category').notNull(),
    obligation: obligationEnum('obligation').notNull(),
    measure: measureEnum('measure').notNull(),
    unit: text('unit'),
    schedule: jsonb('schedule').$type<Record<string, unknown>>().notNull(),
    dailyTarget: numeric('daily_target', { mode: 'number' }),
    enabled: boolean('enabled').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('user_activities_catalog_uq')
      .on(t.userId, t.catalogKey)
      .where(sql`${t.catalogKey} is not null`),
    index('user_activities_user_idx').on(t.userId),
    check(
      'user_activities_custom_ck',
      sql`${t.catalogKey} is not null or (${t.obligation} = 'voluntary' and ${t.name} is not null)`,
    ),
    check(
      'user_activities_target_ck',
      sql`${t.dailyTarget} is null or ${t.obligation} = 'voluntary'`,
    ),
  ],
);

/** One log per activity per tracking day (ADR-001). The client generates the id, so offline writes stay safe to repeat. */
export const worshipLogs = app.table(
  'worship_logs',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => userActivities.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    prayerStatus: prayerStatusEnum('prayer_status'),
    done: boolean('done'),
    amount: numeric('amount', { mode: 'number' }),
    /** Last-write-wins across devices. */
    clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('worship_logs_day_uq').on(t.userId, t.activityId, t.localDate),
    index('worship_logs_user_date_idx').on(t.userId, t.localDate),
    check(
      'worship_logs_one_value_ck',
      sql`num_nonnulls(${t.prayerStatus}, ${t.done}, ${t.amount}) = 1`,
    ),
    check('worship_logs_amount_ck', sql`${t.amount} is null or ${t.amount} >= 0`),
  ],
);

/** Per-day flags. Excused days leave prayer and fasting consistency counts. */
export const dayFlags = app.table(
  'day_flags',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    excused: boolean('excused').notNull().default(false),
    travelling: boolean('travelling').notNull().default(false),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.localDate] })],
);
