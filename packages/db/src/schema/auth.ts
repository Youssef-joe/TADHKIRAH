import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  customType,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/** Identity and sessions. Private user data lives in `app`; editorial content in `content`. */
export const auth = pgSchema('auth');

export const userStatus = auth.enum('user_status', ['active', 'pending_deletion']);
export const sessionKind = auth.enum('session_kind', ['cookie', 'bearer']);
export const oauthProvider = auth.enum('oauth_provider', ['google', 'apple']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = auth.table(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    /** Stored lowercased by the application; unique on lower(email). */
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    status: userStatus('status').notNull().default('active'),
    deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
    /** Reminder planner bookkeeping (Architecture §8.3). */
    planHorizon: timestamp('plan_horizon', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`)],
);

export const emailTokens = auth.table(
  'email_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    email: text('email').notNull(),
    tokenHash: bytea('token_hash').notNull().unique(),
    codeHash: bytea('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('email_tokens_email_expires_idx').on(t.email, t.expiresAt)],
);

export const sessions = auth.table(
  'sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull().unique(),
    kind: sessionKind('kind').notNull(),
    deviceLabel: text('device_label'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/**
 * Fixed-window rate-limit counters, stored in Postgres so limits survive restarts
 * and are shared by every API instance. Old windows are purged by the worker.
 */
export const rateLimits = auth.table(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/**
 * Google / Apple accounts linked to a user (ACC-2). Matched on the provider's
 * stable subject id, not the email, so a changed or relay email still signs in
 * to the same account. Only the email and the subject are kept: no name, no
 * picture, no provider tokens.
 */
export const oauthIdentities = auth.table(
  'oauth_identities',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProvider('provider').notNull(),
    subject: text('subject').notNull(),
    /** The email the provider reported when the account was linked. */
    email: text('email'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('oauth_identities_provider_subject_uq').on(t.provider, t.subject),
    index('oauth_identities_user_idx').on(t.userId),
  ],
);
