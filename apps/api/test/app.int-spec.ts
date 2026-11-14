import 'reflect-metadata';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { INestApplication } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import request from 'supertest';
import { createApiApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';

const require = createRequire(import.meta.url);

describe('API against a real PostgreSQL (Testcontainers)', () => {
  let pg: StartedPostgreSqlContainer;
  let app: INestApplication;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:18-alpine').start();
    const url = pg.getConnectionUri();
    // Run the same migration entry point production uses.
    const migrate = require.resolve('@tadhkirah/db').replace(/index\.js$/, 'migrate.js');
    execFileSync(process.execPath, [migrate], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
    app = await createApiApp(loadEnv({ DATABASE_URL: url, NODE_ENV: 'test', LOG_LEVEL: 'error' }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  it('GET /healthz is live', async () => {
    const res = await request(app.getHttpServer()).get('/healthz').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readyz reports the database as reachable', async () => {
    const res = await request(app.getHttpServer()).get('/readyz').expect(200);
    expect(res.body.checks).toEqual({ database: 'ok' });
  });

  it('migrations created the auth schema with uuidv7 defaults', async () => {
    const { Client } = await import('pg');
    const c = new Client({ connectionString: pg.getConnectionUri() });
    await c.connect();
    const r = await c.query("insert into auth.users (email) values ('a@example.com') returning id");
    expect(r.rows[0].id).toMatch(/^[0-9a-f-]{8}-[0-9a-f]{4}-7/);
    await expect(
      c.query("insert into auth.users (email) values ('A@EXAMPLE.COM')"),
    ).rejects.toThrow(/users_email_lower_uq/);
    await c.end();
  });

  it('unknown routes return RFC 9457 problem+json under /v1', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, code: 'not_found', instance: '/v1/nope' });
  });
});
