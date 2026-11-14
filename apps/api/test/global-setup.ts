import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let pg: StartedPostgreSqlContainer | undefined;

/** One PostgreSQL 18 container for the whole run, migrated with the production entry point. */
export async function setup(project: TestProject) {
  pg = await new PostgreSqlContainer('postgres:18-alpine').start();
  const url = pg.getConnectionUri();
  const require = createRequire(import.meta.url);
  const migrate = require.resolve('@tadhkirah/db').replace(/index\.js$/, 'migrate.js');
  execFileSync(process.execPath, [migrate], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  project.provide('databaseUrl', url);
}

export async function teardown() {
  await pg?.stop();
}
