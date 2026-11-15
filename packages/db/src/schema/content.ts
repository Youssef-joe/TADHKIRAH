import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { auth, users } from './auth.js';

/**
 * Verified Islamic content (Modules C, D; docs/03-data-model.md §3.3).
 * Shared editorial data, not per-user data: it is protected by editorial roles,
 * the review workflow, and the publication views (migration 0016), which are the
 * only thing the public API reads.
 */
export const content = pgSchema('content');

export const contentStatusEnum = content.enum('status', [
  'draft',
  'awaiting_verification',
  'verified',
  'approved',
  'rejected',
  'archived',
]);
export const gradeEnum = content.enum('grade', [
  'sahih',
  'hasan',
  'sahih_li_ghayrihi',
  'hasan_li_ghayrihi',
  'daif',
  'mawdu',
]);
export const subjectTypeEnum = content.enum('subject_type', ['hadith', 'sunnah', 'occasion']);
export const differenceKindEnum = content.enum('difference_kind', [
  'authentication',
  'interpretation',
  'timing',
]);
export const classificationEnum = content.enum('classification', [
  'established',
  'less_commonly_practiced',
]);
export const evidenceTypeEnum = content.enum('evidence_type', [
  'explicit_text',
  'scholarly_interpretation',
]);

/** Columns every reviewed item has. */
const editorial = {
  status: contentStatusEnum('status').notNull().default('draft'),
  revision: integer('revision').notNull().default(1),
  supersedesId: uuid('supersedes_id'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  /** Re-review cycle: when a reviewer last confirmed the published item. */
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  /** When it's next due for re-review; a problem report brings it forward to now. */
  reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`);

export const hadithSources = content.table('hadith_sources', {
  id: id(),
  key: text('key').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  numberingScheme: text('numbering_scheme').notNull(),
  baseUrl: text('base_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Companion narrator only; full isnad modelling is out of scope. */
export const narrators = content.table('narrators', {
  id: id(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hadiths = content.table(
  'hadiths',
  {
    id: id(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => hadithSources.id),
    /** Text, because of formats like `1048` or `2/134`. */
    number: text('number').notNull(),
    bookChapter: text('book_chapter'),
    narratorId: uuid('narrator_id').references(() => narrators.id),
    /** Entered by a person from the primary source. Required before review. */
    textAr: text('text_ar'),
    isExcerpt: boolean('is_excerpt').notNull().default(false),
    translationEn: text('translation_en'),
    /** Translator and licence, or the reviewer who wrote it. */
    translationBy: text('translation_by'),
    sourceUrl: text('source_url'),
    /** Internal notes for the editorial team (e.g. "AI-suggested lead: verify"). Never public. */
    editorNotes: text('editor_notes'),
    ...editorial,
  },
  (t) => [
    uniqueIndex('hadiths_source_number_rev_uq').on(t.sourceId, t.number, t.revision),
    index('hadiths_status_idx').on(t.status),
  ],
);

export const hadithAuthentications = content.table('hadith_authentications', {
  id: id(),
  hadithId: uuid('hadith_id')
    .notNull()
    .references(() => hadiths.id, { onDelete: 'cascade' }),
  grade: gradeEnum('grade').notNull(),
  scholar: text('scholar').notNull(),
  workCited: text('work_cited').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** "Some scholars hold…": shown to users whenever present (CON-6). */
export const scholarlyDifferences = content.table(
  'scholarly_differences',
  {
    id: id(),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    kind: differenceKindEnum('kind').notNull(),
    summaryAr: text('summary_ar').notNull(),
    summaryEn: text('summary_en').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scholarly_differences_subject_idx').on(t.subjectType, t.subjectId)],
);

export const sunnahs = content.table(
  'sunnahs',
  {
    id: id(),
    slug: text('slug').notNull(),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull(),
    descriptionAr: text('description_ar').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    instructionsAr: text('instructions_ar'),
    instructionsEn: text('instructions_en'),
    classification: classificationEnum('classification').notNull().default('established'),
    /** When it applies: on_waking, before_sleep, eating, entering_mosque, friday, daily. */
    trigger: text('trigger').notNull().default('daily'),
    ...editorial,
  },
  (t) => [
    uniqueIndex('sunnahs_slug_rev_uq').on(t.slug, t.revision),
    // At most one published revision per slug.
    uniqueIndex('sunnahs_slug_approved_uq')
      .on(t.slug)
      .where(sql`${t.status} = 'approved'`),
  ],
);

export const supplicationOccasions = content.table(
  'supplication_occasions',
  {
    id: id(),
    slug: text('slug').notNull(),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull(),
    explanationAr: text('explanation_ar').notNull().default(''),
    explanationEn: text('explanation_en').notNull().default(''),
    /**
     * How the period is found from prayer times: last_third_of_night,
     * jumuah_imam_to_prayer, friday_last_hour_after_asr, between_adhan_iqamah,
     * or a non-schedulable act (in_sujud, anytime).
     */
    window: text('window').notNull(),
    evidenceType: evidenceTypeEnum('evidence_type').notNull().default('explicit_text'),
    schedulable: boolean('schedulable').notNull().default(true),
    ...editorial,
  },
  (t) => [
    uniqueIndex('occasions_slug_rev_uq').on(t.slug, t.revision),
    uniqueIndex('occasions_slug_approved_uq')
      .on(t.slug)
      .where(sql`${t.status} = 'approved'`),
  ],
);

export const sunnahHadiths = content.table(
  'sunnah_hadiths',
  {
    sunnahId: uuid('sunnah_id')
      .notNull()
      .references(() => sunnahs.id, { onDelete: 'cascade' }),
    hadithId: uuid('hadith_id')
      .notNull()
      .references(() => hadiths.id),
    relevance: text('relevance'),
  },
  (t) => [primaryKey({ columns: [t.sunnahId, t.hadithId] })],
);

export const occasionHadiths = content.table(
  'occasion_hadiths',
  {
    occasionId: uuid('occasion_id')
      .notNull()
      .references(() => supplicationOccasions.id, { onDelete: 'cascade' }),
    hadithId: uuid('hadith_id')
      .notNull()
      .references(() => hadiths.id),
    relevance: text('relevance'),
  },
  (t) => [primaryKey({ columns: [t.occasionId, t.hadithId] })],
);

/**
 * Append-only review history (CON-5). A trigger refuses UPDATE and DELETE.
 * Actor ids are plain values, not foreign keys, so deleting a staff account
 * can't rewrite history.
 */
export const reviewRecords = content.table(
  'review_records',
  {
    id: id(),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    subjectRevision: integer('subject_revision').notNull(),
    action: text('action').notNull(),
    fromStatus: contentStatusEnum('from_status').notNull(),
    toStatus: contentStatusEnum('to_status').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorRole: text('actor_role').notNull(),
    singleReviewer: boolean('single_reviewer').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('review_records_subject_idx').on(t.subjectType, t.subjectId)],
);

/** "Report a problem with this source" from users (editorial queue). */
export const issueReports = content.table('issue_reports', {
  id: id(),
  subjectType: subjectTypeEnum('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  message: text('message').notNull(),
  reportedBy: uuid('reported_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** When each reviewer last got the re-review digest email (at most daily). */
export const reviewerDigests = content.table('reviewer_digests', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull(),
});

/** Editorial roles (ADR-003). Granted by an admin, never self-service. */
export const editorialRoleEnum = auth.enum('editorial_role', [
  'admin',
  'editor',
  'reviewer',
  'publisher',
]);

export const userRoles = auth.table(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: editorialRoleEnum('role').notNull(),
    grantedBy: uuid('granted_by'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

/** Append-only log of role grants and revocations. */
export const roleAudit = auth.table('role_audit', {
  id: id(),
  userId: uuid('user_id').notNull(),
  role: editorialRoleEnum('role').notNull(),
  action: text('action').notNull(),
  actorUserId: uuid('actor_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
