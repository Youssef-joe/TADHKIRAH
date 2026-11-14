import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  jsonb,
  numeric,
  primaryKey,
  smallint,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { app } from './app.js';
import { users } from './auth.js';

export const memorizationStatusEnum = app.enum('memorization_status', [
  'not_started',
  'in_progress',
  'memorized',
]);
export const revisionQualityEnum = app.enum('revision_quality', [
  'smooth',
  'some_mistakes',
  'needs_work',
]);

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Daily recitation (QUR-1): pages and/or a surah:ayah range. The client generates the id, so repeated saves are safe. */
export const quranRecitations = app.table(
  'quran_recitations',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    pages: numeric('pages', { mode: 'number' }),
    fromSurah: smallint('from_surah'),
    fromAyah: smallint('from_ayah'),
    toSurah: smallint('to_surah'),
    toAyah: smallint('to_ayah'),
    createdAt,
  },
  (t) => [
    index('quran_recitations_user_date_idx').on(t.userId, t.localDate),
    check('quran_recitations_has_value_ck', sql`${t.pages} > 0 or ${t.fromSurah} is not null`),
    check(
      'quran_recitations_range_ck',
      sql`num_nonnulls(${t.fromSurah}, ${t.fromAyah}, ${t.toSurah}, ${t.toAyah}) in (0, 4)`,
    ),
  ],
);

/** Memorization per surah (QUR-3): status, ayah ranges, last revision. */
export const quranMemorization = app.table(
  'quran_memorization',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    surah: smallint('surah').notNull(),
    status: memorizationStatusEnum('status').notNull().default('not_started'),
    ranges: jsonb('ranges').$type<[number, number][]>().notNull().default([]),
    lastRevisedOn: date('last_revised_on'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.surah] }),
    check('quran_memorization_surah_ck', sql`${t.surah} between 1 and 114`),
  ],
);

/** Revision log (QUR-4). */
export const quranRevisions = app.table(
  'quran_revisions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: date('local_date').notNull(),
    surah: smallint('surah').notNull(),
    fromAyah: smallint('from_ayah').notNull(),
    toAyah: smallint('to_ayah').notNull(),
    quality: revisionQualityEnum('quality'),
    createdAt,
  },
  (t) => [
    index('quran_revisions_user_surah_idx').on(t.userId, t.surah, t.localDate),
    check('quran_revisions_range_ck', sql`${t.fromAyah} <= ${t.toAyah}`),
  ],
);
