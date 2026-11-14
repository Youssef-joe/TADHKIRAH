/**
 * Applies pending migrations, then exits. In production it runs as the one-shot
 * `migrate` service in docker-compose, before `api` and `worker` start (ADR-002).
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index.js';

const url = process.env.DATABASE_URL;
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
