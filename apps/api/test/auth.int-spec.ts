import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MemoryMailer } from '../src/auth/mailer.js';
import {
  codeFrom,
  sessionCookie,
  signIn,
  startApp,
  TEST_ORIGIN,
  tokenFrom,
  uniqueEmail,
  uniqueIp,
} from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };

describe('auth (M1)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
  });
  afterAll(async () => {
    await app?.close();
  });

  it('signs up with an emailed code and sets a secure-by-default session cookie', async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();
    await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', ip)
      .send({ email, locale: 'en' })
      .expect(202);

    const mail = mailer.lastTo(email)!;
    expect(mail.subject).toBe('Your Tadhkirah sign-in code');
    expect(mail.text).toContain(`${TEST_ORIGIN}/en/verify#token=`);

    const res = await http()
      .post('/v1/auth/email/verify')
      .set('X-Forwarded-For', ip)
      .set(
        'User-Agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/605.1.15',
      )
      .send({
        email: email.toUpperCase(),
        code: codeFrom(mailer, email),
        locale: 'en',
        timeZone: 'Asia/Dubai',
      })
      .expect(200);
    expect(res.body).toMatchObject({ isNew: true, locale: 'en', user: { email } });
    expect(res.body.accessToken).toBeUndefined();
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    const me = await http().get('/v1/me').set('Cookie', sessionCookie(res)).expect(200);
    expect(me.body).toMatchObject({
      email,
      profile: { locale: 'en', digits: 'latn', timezone: 'Asia/Dubai', displayName: null },
      preferences: { weekStart: 1, hijriOffset: 0, backfillDays: 7, theme: 'system' },
    });

    const sessions = await http()
      .get('/v1/auth/sessions')
      .set('Cookie', sessionCookie(res))
      .expect(200);
    expect(sessions.body[0]).toMatchObject({ current: true, deviceLabel: 'Safari · iPhone' });
  });

  it('defaults new Arabic accounts to Arabic digits and a Saturday week start', async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();
    await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', ip)
      .send({ email })
      .expect(202);
    expect(mailer.lastTo(email)!.subject).toBe('رَمْزُ الدُّخُولِ إِلَى تَذْكِرَة');
    const res = await http()
      .post('/v1/auth/email/verify')
      .set('X-Forwarded-For', ip)
      .send({ email, code: codeFrom(mailer, email) })
      .expect(200);
    const me = await http().get('/v1/me').set('Cookie', sessionCookie(res)).expect(200);
    expect(me.body.profile).toMatchObject({
      locale: 'ar',
      digits: 'arab',
      timezone: 'Asia/Riyadh',
    });
    expect(me.body.preferences.weekStart).toBe(6);
  });

  it('signs in with the magic link exactly once, and returning users are not new', async () => {
    const { email } = await signIn(app, mailer);
    const ip = uniqueIp();
    await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', ip)
      .send({ email, locale: 'en' })
      .expect(202);
    const token = tokenFrom(mailer, email);

    const res = await http()
      .post('/v1/auth/email/verify')
      .set('X-Forwarded-For', ip)
      .send({ token })
      .expect(200);
    expect(res.body.isNew).toBe(false);
    const reused = await http()
      .post('/v1/auth/email/verify')
      .set('X-Forwarded-For', ip)
      .send({ token })
      .expect(400);
    expect(reused.body.code).toBe('auth.invalid_code');
  });

  it('issues a bearer token to mobile clients, exempt from the CSRF header', async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();
    await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', ip)
      .send({ email })
      .expect(202);
    const res = await http()
      .post('/v1/auth/email/verify')
      .set('X-Forwarded-For', ip)
      .send({ email, code: codeFrom(mailer, email), client: 'mobile', deviceLabel: 'Pixel 9' })
      .expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    const auth = `Bearer ${res.body.accessToken}`;
    await http()
      .patch('/v1/me/profile')
      .set('Authorization', auth)
      .send({ displayName: 'Yusuf' })
      .expect(200);
  });

  it('responds identically for unknown emails (no account enumeration)', async () => {
    await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: uniqueEmail() })
      .expect(202);
  });

  it('burns a code after 10 wrong attempts', async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();
    await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', ip)
      .send({ email })
      .expect(202);
    const code = codeFrom(mailer, email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 10; i++) {
      await http()
        .post('/v1/auth/email/verify')
        .set('X-Forwarded-For', ip)
        .send({ email, code: wrong })
        .expect(400);
    }
    await http()
      .post('/v1/auth/email/verify')
      .set('X-Forwarded-For', ip)
      .send({ email, code })
      .expect(400);
  });

  it('rate-limits sign-in emails per address (5 per hour) with Retry-After', async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/v1/auth/email/start')
        .set('X-Forwarded-For', uniqueIp())
        .send({ email })
        .expect(202);
    }
    const res = await http()
      .post('/v1/auth/email/start')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email })
      .expect(429);
    expect(res.body.code).toBe('auth.rate_limited');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('lists and revokes sessions; revoked and logged-out sessions stop working', async () => {
    const first = await signIn(app, mailer);
    const second = await signIn(app, mailer, first.email);

    const list = await http().get('/v1/auth/sessions').set('Cookie', second.cookie).expect(200);
    expect(list.body).toHaveLength(2);
    const other = list.body.find((s: { current: boolean }) => !s.current);

    await http()
      .delete(`/v1/auth/sessions/${other.id}`)
      .set('Cookie', second.cookie)
      .set(CSRF)
      .expect(204);
    await http().get('/v1/me').set('Cookie', first.cookie).expect(401);

    // Someone else's session ID behaves exactly like a missing one.
    const stranger = await signIn(app, mailer);
    const strangerSessions = await http()
      .get('/v1/auth/sessions')
      .set('Cookie', stranger.cookie)
      .expect(200);
    await http()
      .delete(`/v1/auth/sessions/${strangerSessions.body[0].id}`)
      .set('Cookie', second.cookie)
      .set(CSRF)
      .expect(404);
    await http().get('/v1/me').set('Cookie', stranger.cookie).expect(200);

    await http().post('/v1/auth/logout').set('Cookie', second.cookie).set(CSRF).expect(204);
    await http().get('/v1/me').set('Cookie', second.cookie).expect(401);
  });

  it('enforces CSRF protection on cookie-authenticated writes', async () => {
    const { cookie } = await signIn(app, mailer);
    const noHeader = await http()
      .patch('/v1/me/profile')
      .set('Cookie', cookie)
      .send({ displayName: 'x' })
      .expect(403);
    expect(noHeader.body.code).toBe('csrf.missing_header');

    const evil = await http()
      .post('/v1/auth/email/start')
      .set('Origin', 'https://evil.example')
      .send({ email: uniqueEmail() })
      .expect(403);
    expect(evil.body.code).toBe('csrf.origin_mismatch');

    await http()
      .patch('/v1/me/profile')
      .set('Cookie', cookie)
      .set('Origin', TEST_ORIGIN)
      .set(CSRF)
      .send({ displayName: 'Amina' })
      .expect(200);
  });

  it('validates profile and preference updates', async () => {
    const { cookie } = await signIn(app, mailer);
    const tz = await http()
      .patch('/v1/me/profile')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ timezone: 'Mars/Olympus' });
    expect(tz.status).toBe(400);
    expect(tz.body.errors.timezone).toBeDefined();

    await http()
      .patch('/v1/me/profile')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ isAdmin: true })
      .expect(400);
    await http()
      .patch('/v1/me/preferences')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ hijriOffset: 3 })
      .expect(400);

    const ok = await http()
      .patch('/v1/me/preferences')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ hijriOffset: -1, weekStart: 0, theme: 'dark' })
      .expect(200);
    expect(ok.body).toMatchObject({ hijriOffset: -1, weekStart: 0, theme: 'dark' });
  });

  it('rejects unauthenticated requests with problem+json', async () => {
    const res = await http().get('/v1/me').expect(401);
    expect(res.body.code).toBe('auth.unauthenticated');
    await http().get('/v1/me').set('Cookie', 'tadhkirah_session=forged-token-value').expect(401);
  });
});
