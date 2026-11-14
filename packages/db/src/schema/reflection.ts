import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { app } from './app.js';
import { users } from './auth.js';

/** Ciphertext: version byte | IV | AES-256-GCM ciphertext | tag (Architecture §7). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const answerTypeEnum = app.enum('answer_type', ['yes_partly_no', 'text', 'both']);
export const choiceEnum = app.enum('choice', ['yes', 'partly', 'no', 'prefer_not']);

/**
 * Per-user data-encryption key, wrapped by the master key. Deleting this row
 * makes the user's reflections unrecoverable (crypto-shredding, ACC-6).
 */
export const userKeys = app.table('user_keys', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  wrappedDek: bytea('wrapped_dek').notNull(),
  masterKeyVersion: text('master_key_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** The user's reflection questions: built-in (catalog_key) or their own (encrypted text). */
export const reflectionQuestions = app.table(
  'reflection_questions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    catalogKey: text('catalog_key'),
    textCt: bytea('text_ct'),
    answerType: answerTypeEnum('answer_type').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reflection_questions_catalog_uq')
      .on(t.userId, t.catalogKey)
      .where(sql`${t.catalogKey} is not null`),
    index('reflection_questions_user_idx').on(t.userId),
  ],
);

/** One reflection per user per tracking day (REF-1). All free text is encrypted. */
export const dailyReflections = app.table(
  'daily_reflections',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    /** Optimistic concurrency between devices (If-Match). */
    version: integer('version').notNull().default(1),
    /** JSON array of up to 3 gratitude lines, encrypted. */
    gratitudeCt: bytea('gratitude_ct'),
    shortcomingCt: bytea('shortcoming_ct'),
    repentanceNoted: boolean('repentance_noted').notNull().default(false),
    intentionCt: bytea('intention_ct'),
    freeTextCt: bytea('free_text_ct'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('daily_reflections_day_uq').on(t.userId, t.localDate)],
);

/** Answers: the choice stays plaintext (for reports), any text is encrypted. Skipped questions have no row. */
export const reflectionAnswers = app.table(
  'reflection_answers',
  {
    reflectionId: uuid('reflection_id')
      .notNull()
      .references(() => dailyReflections.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => reflectionQuestions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    choice: choiceEnum('choice'),
    textCt: bytea('text_ct'),
  },
  (t) => [primaryKey({ columns: [t.reflectionId, t.questionId] })],
);
