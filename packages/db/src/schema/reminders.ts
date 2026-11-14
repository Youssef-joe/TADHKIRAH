import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  jsonb,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { app } from './app.js';
import { users } from './auth.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const reminderCategoryEnum = app.enum('reminder_category', [
  'prayer',
  'adhkar_morning',
  'adhkar_evening',
  'quran',
  'reflection',
  'weekly_review',
  'custom',
]);
export const reminderStatusEnum = app.enum('reminder_status', [
  'pending',
  'sending',
  'sent',
  'failed',
  'expired',
  'suppressed',
  'cancelled',
]);
export const reminderSourceEnum = app.enum('reminder_source', ['planned', 'snooze']);

/** Notification settings (NOT-3, NOT-5). */
export const notificationPreferences = app.table('notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  quietStart: time('quiet_start'),
  quietEnd: time('quiet_end'),
  dailyCap: smallint('daily_cap').notNull().default(6),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Web Push subscriptions (one per browser/device). FCM/APNs arrive in Phase 4. */
export const pushDevices = app.table(
  'push_devices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('push_devices_endpoint_uq').on(t.endpoint)],
);

/** Reminder rules (NOT-1/2). Custom titles are encrypted. */
export const reminderRules = app.table(
  'reminder_rules',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: reminderCategoryEnum('category').notNull(),
    timing: jsonb('timing').$type<Record<string, unknown>>().notNull(),
    days: smallint('days').array(),
    enabled: boolean('enabled').notNull().default(false),
    allowInQuietHours: boolean('allow_in_quiet_hours').notNull().default(false),
    customTitleCt: bytea('custom_title_ct'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reminder_rules_user_idx').on(t.userId)],
);

/** Planned instances. UNIQUE (user, rule, fire_at) makes planning idempotent (NOT-6). */
export const scheduledReminders = app.table(
  'scheduled_reminders',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => reminderRules.id, { onDelete: 'cascade' }),
    fireAt: timestamp('fire_at', { withTimezone: true }).notNull(),
    source: reminderSourceEnum('source').notNull().default('planned'),
    status: reminderStatusEnum('status').notNull().default('pending'),
    suppressReason: text('suppress_reason'),
    attempts: smallint('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scheduled_reminders_uq').on(t.userId, t.ruleId, t.fireAt),
    index('scheduled_reminders_due_idx')
      .on(t.fireAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/**
 * Sent notifications = the in-app inbox (NOT-7/8). Stores the category and rule
 * only (no message text), so nothing private sits here in plaintext.
 */
export const notificationLog = app.table(
  'notification_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scheduledId: uuid('scheduled_id').references(() => scheduledReminders.id, {
      onDelete: 'set null',
    }),
    ruleId: uuid('rule_id').references(() => reminderRules.id, { onDelete: 'set null' }),
    category: reminderCategoryEnum('category').notNull(),
    params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
    pushed: smallint('pushed').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('notification_log_scheduled_uq').on(t.scheduledId),
    index('notification_log_user_idx').on(t.userId, t.sentAt),
  ],
);
