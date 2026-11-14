import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import { inject } from 'vitest';
import { startApp } from './helpers.js';

describe('platform', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await startApp());
  });
  afterAll(async () => {
    await app?.close();
  });

  it('GET /healthz is live', async () => {
    const res = await request(app.getHttpServer()).get('/healthz').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readyz reports the database as reachable', async () => {
    const res = await request(app.getHttpServer()).get('/readyz').expect(200);
    expect(res.body.checks).toEqual({ database: 'ok' });
  });

  it('migrations created auth.users with uuidv7 ids and case-insensitive unique emails', async () => {
    const c = new pg.Client({ connectionString: inject('databaseUrl') });
    await c.connect();
    try {
      const r = await c.query(
        "insert into auth.users (email) values ('platform@example.com') returning id",
      );
      expect(r.rows[0].id).toMatch(/^[0-9a-f-]{8}-[0-9a-f]{4}-7/);
      await expect(
        c.query("insert into auth.users (email) values ('PLATFORM@EXAMPLE.COM')"),
      ).rejects.toThrow(/users_email_lower_uq/);
    } finally {
      await c.end();
    }
  });

  it('unknown routes return RFC 9457 problem+json under /v1', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, code: 'not_found', instance: '/v1/nope' });
  });
});
