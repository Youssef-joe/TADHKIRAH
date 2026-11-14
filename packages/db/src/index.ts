import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export * as schema from './schema/index.js';
export { and, asc, eq, gt, inArray, isNull, lt, desc, sql } from 'drizzle-orm';

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

/** The role user-scoped transactions switch to, so RLS applies (migration 0002). */
export const APP_ROLE = 'tadhkirah_app';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDb(connectionString: string, opts: { max?: number } = {}): DbHandle {
  const pool = new pg.Pool({ connectionString, max: opts.max ?? 10 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}

/**
 * Runs `fn` in a transaction scoped to one user. Row-level security then limits
 * every `app.*` query to that user's rows, even if a WHERE clause is missing.
 * Repositories should still filter by user ID explicitly: RLS is the second line
 * of defence, not the first.
 *
 * The settings are transaction-local (`set_config(..., true)` / `SET LOCAL`), so
 * they never leak to other requests sharing the pooled connection.
 */
export async function withUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await scopeToUser(tx, userId);
    return fn(tx);
  });
}

/**
 * Scopes an already-open transaction to `userId`. After this call the transaction
 * can no longer touch `auth.*` tables, so do any auth work first.
 */
export async function scopeToUser(tx: Tx, userId: string): Promise<void> {
  if (!UUID_RE.test(userId)) throw new Error('scopeToUser: invalid user id');
  await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
  await tx.execute(sql.raw(`set local role ${APP_ROLE}`));
}

/**
 * Runs `fn` as a background job across all users (reminder planner and
 * dispatcher). It runs as the table owner and enables only the narrow
 * `system_jobs` policies (migration 0014): reminder tables plus the profile,
 * prayer-settings and preference rows needed to compute times. Private
 * content (reflections, goals, reviews) has no such policy and stays
 * invisible here.
 */
export async function withSystem<T>(db: Database, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.system', 'on', true)`);
    return fn(tx);
  });
}
