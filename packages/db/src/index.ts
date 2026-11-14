import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export * as schema from './schema/index.js';
export { sql } from 'drizzle-orm';

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

export function createDb(connectionString: string, opts: { max?: number } = {}): DbHandle {
  const pool = new pg.Pool({ connectionString, max: opts.max ?? 10 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}
