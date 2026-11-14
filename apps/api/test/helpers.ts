import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { inject } from 'vitest';
import { MAILER, type MemoryMailer } from '../src/auth/mailer.js';
import { createApiApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';

export const TEST_ORIGIN = 'http://localhost:3000';

export async function startApp(): Promise<{ app: INestApplication; mailer: MemoryMailer }> {
  const env = loadEnv({
    DATABASE_URL: inject('databaseUrl'),
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
    MAIL_TRANSPORT: 'memory',
    WEB_ORIGINS: TEST_ORIGIN,
  });
  const app = await createApiApp(env);
  await app.init();
  return { app, mailer: app.get<MemoryMailer>(MAILER) };
}

/** A unique email and client IP per test, so rate limits don't spill across tests. */
export function uniqueEmail(): string {
  return `user-${randomBytes(6).toString('hex')}@example.com`;
}
export function uniqueIp(): string {
  const b = randomBytes(2);
  return `198.18.${b[0]}.${b[1]}`;
}

export function codeFrom(mailer: MemoryMailer, email: string): string {
  const text = mailer.lastTo(email)?.text ?? '';
  const m = /(\d{6})/.exec(text);
  if (!m) throw new Error(`no code in email to ${email}`);
  return m[1]!;
}

export function tokenFrom(mailer: MemoryMailer, email: string): string {
  const text = mailer.lastTo(email)?.text ?? '';
  const m = /#token=([\w-]+)/.exec(text);
  if (!m) throw new Error(`no magic link in email to ${email}`);
  return m[1]!;
}

export function sessionCookie(res: request.Response): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const c = raw.find((s) => s.startsWith('tadhkirah_session='));
  if (!c) throw new Error('no session cookie');
  return c.split(';')[0]!;
}

/** Full sign-in with the emailed code. Returns the session cookie. */
export async function signIn(
  app: INestApplication,
  mailer: MemoryMailer,
  email = uniqueEmail(),
  extra: Record<string, unknown> = {},
): Promise<{ cookie: string; email: string; body: Record<string, unknown> }> {
  const ip = uniqueIp();
  const http = request(app.getHttpServer());
  await http
    .post('/v1/auth/email/start')
    .set('X-Forwarded-For', ip)
    .send({ email, locale: 'en' })
    .expect(202);
  const res = await http
    .post('/v1/auth/email/verify')
    .set('X-Forwarded-For', ip)
    .send({ email, code: codeFrom(mailer, email), ...extra })
    .expect(200);
  return { cookie: sessionCookie(res), email, body: res.body };
}
