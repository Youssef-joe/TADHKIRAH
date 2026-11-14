import { sql } from 'drizzle-orm';
import { customType, date, index, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { app } from './app.js';
import { users } from './auth.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const goalStatusEnum = app.enum('goal_status', ['active', 'done', 'let_go']);
export const goalSourceEnum = app.enum('goal_source', [
  'weekly_review',
  'daily_intention',
  'manual',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** The four weekly prompts (REP-6). Every answer is encrypted. */
export const weeklyReviews = app.table(
  'weekly_reviews',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    improvedCt: bytea('improved_ct'),
    neglectedCt: bytea('neglected_ct'),
    madeEasierCt: bytea('made_easier_ct'),
    changeNextCt: bytea('change_next_ct'),
    ...timestamps,
  },
  (t) => [uniqueIndex('weekly_reviews_week_uq').on(t.userId, t.weekStart)],
);

/** Improvement goals. Statuses are "done" or "let go", never "failed". The text is encrypted. */
export const improvementGoals = app.table(
  'improvement_goals',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    textCt: bytea('text_ct').notNull(),
    source: goalSourceEnum('source').notNull().default('manual'),
    status: goalStatusEnum('status').notNull().default('active'),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    ...timestamps,
  },
  (t) => [index('improvement_goals_user_status_idx').on(t.userId, t.status)],
);
