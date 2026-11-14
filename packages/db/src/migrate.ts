/**
 * Applies pending migrations, then exits.
 *  - Docker/Coolify: runs as the one-shot `migrate` service before `api` and `worker` start.
 *  - Vercel: runs in the API build, only for production deployments. Previews
 *    share the production database for now, so they must never migrate it.
 * Uses the direct (unpooled) connection when one is available, because
 * migrations shouldn't go through a transaction pooler.
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index.js';

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
  console.log(`skipping migrations for a ${process.env.VERCEL_ENV} deployment`);
  process.exit(0);
}

const url =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const handle = createDb(url, { max: 1 });
try {
  await migrate(handle.db, { migrationsFolder });
  console.log('migrations applied');
} catch (err) {
  console.error('migration failed', err);
  process.exitCode = 1;
} finally {
  await handle.close();
}
