/**
 * Applies pending migrations, then exits.
 *  - Docker/Coolify: runs as the one-shot `migrate` service before `api` and `worker` start.
 *  - Vercel: runs in the API build. Production migrates its database. Previews
 *    have their own separate database (tadhkirah-preview-db) and migrate it only
 *    when ALLOW_PREVIEW_MIGRATIONS=true is set for the Preview environment, so a
 *    preview can never migrate production by accident if the variables are mixed up.
 * Uses the direct (unpooled) connection when one is available, because
 * migrations shouldn't go through a transaction pooler.
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index.js';

const vercelEnv = process.env.VERCEL_ENV;
const previewAllowed = vercelEnv === 'preview' && process.env.ALLOW_PREVIEW_MIGRATIONS === 'true';
if (vercelEnv && vercelEnv !== 'production' && !previewAllowed) {
  console.log(`skipping migrations for a ${vercelEnv} deployment`);
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
