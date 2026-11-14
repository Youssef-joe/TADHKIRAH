import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inject } from 'vitest';
import { createDb, type DbHandle } from '@tadhkirah/db';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp, TEST_CRON_SECRET } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
type Q = { id: string; catalogKey: string | null };

describe('privacy: export and account deletion (M8)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  let h: DbHandle;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
    h = createDb(inject('databaseUrl'));
  });
  afterAll(async () => {
    await h?.close();
    await app?.close();
  });

  /** A user with a reflection, a goal and a custom reminder: all encrypted at rest. */
  async function setup(marker: string) {
    const { cookie, email } = await signIn(app, mailer);
    const me = await http().get('/v1/me').set('Cookie', cookie).expect(200);
    const meta = await http()
      .get('/v1/worship/logs?from=2026-01-01&to=2026-01-01')
      .set('Cookie', cookie)
      .expect(200);
    const today = meta.body.today as string;
    const day = await http().get(`/v1/reflections/${today}`).set('Cookie', cookie).expect(200);
    const q = (k: string) => (day.body.questions as Q[]).find((x) => x.catalogKey === k)!;
    await http()
      .put(`/v1/reflections/${today}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        answers: [{ questionId: q('remembrance').id, choice: 'partly' }],
        gratitude: [`gratitude ${marker}`],
        intention: `intention ${marker}`,
      })
      .expect(200);
    await http()
      .post('/v1/goals')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ text: `goal ${marker}` })
      .expect(201);
    await http()
      .post('/v1/reminders/rules')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ customTitle: `title ${marker}`, timing: { type: 'fixed', time: '18:00' } })
      .expect(201);
    return { cookie, email, userId: me.body.id as string, today };
  }

  async function rowsFor(userId: string): Promise<Record<string, number>> {
    const { rows } = await h.pool.query<{ table_name: string }>(
      `select table_name from information_schema.columns where table_schema = 'app' and column_name = 'user_id'`,
    );
    const counts: Record<string, number> = {};
    for (const { table_name } of rows) {
      const r = await h.pool.query(
        `select count(*)::int as n from app."${table_name}" where user_id = $1`,
        [userId],
      );
      counts[table_name] = r.rows[0].n;
    }
    return counts;
  }

  it('exports everything decrypted as JSON, without secrets, and is never cached', async () => {
    const { cookie, email, today } = await setup('m-json');
    const res = await http().get('/v1/me/export?format=json').set('Cookie', cookie).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="tadhkirah-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const data = JSON.parse(res.text);
    expect(data).toMatchObject({ format: 'tadhkirah-export', version: 1, account: { email } });
    expect(data.reflection.days).toEqual([
      expect.objectContaining({
        date: today,
        gratitude: ['gratitude m-json'],
        intention: 'intention m-json',
      }),
    ]);
    expect(data.weekly.goals[0].text).toBe('goal m-json');
    expect(
      data.reminders.rules.find((r: { category: string }) => r.category === 'custom').customTitle,
    ).toBe('title m-json');
    expect(res.text).not.toMatch(/tokenHash|wrappedDek|token_hash|"userId"|Ct"/);
  });

  it('exports readable Markdown in the user’s language', async () => {
    const { cookie } = await setup('m-md');
    await http()
      .patch('/v1/me/profile')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ locale: 'ar' })
      .expect(200);
    const res = await http().get('/v1/me/export?format=md').set('Cookie', cookie).expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/markdown/);
    expect(res.text).toContain('# تَذْكِرَة: نُسْخَةٌ مِنْ بَيَانَاتِك');
    expect(res.text).toContain('هَلْ ذَكَرْتُ اللَّهَ فِي يَوْمِي؟** إِلَى حَدٍّ مَا');
    expect(res.text).toContain('intention m-md');
    expect(res.text).toContain('goal m-md');
  });

  it('export needs a session', async () => {
    await http().get('/v1/me/export').expect(401);
  });

  it('refuses deletion when the typed email does not match, and changes nothing', async () => {
    const { cookie, userId } = await setup('m-keep');
    const res = await http()
      .post('/v1/me/delete')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ confirmEmail: 'someone@else.example' })
      .expect(422);
    expect(res.body.code).toBe('privacy.confirm_mismatch');
    await http().get('/v1/me').set('Cookie', cookie).expect(200);
    expect((await rowsFor(userId)).user_keys).toBe(1);
  });

  it('deletes the account: key destroyed, sessions dead, every row gone, others untouched (AC-DEL)', async () => {
    const other = await setup('m-other');
    const { cookie, email, userId } = await setup('m-del');
    expect((await rowsFor(userId)).daily_reflections).toBe(1);

    const res = await http()
      .post('/v1/me/delete')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ confirmEmail: email.toUpperCase() })
      .expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/tadhkirah_session=;/);

    await http().get('/v1/me').set('Cookie', cookie).expect(401);
    const { rows } = await h.pool.query('select count(*)::int as n from auth.users where id = $1', [
      userId,
    ]);
    expect(rows[0].n).toBe(0);
    const { rows: sess } = await h.pool.query(
      'select count(*)::int as n from auth.sessions where user_id = $1',
      [userId],
    );
    expect(sess[0].n).toBe(0);
    expect(Object.values(await rowsFor(userId)).every((n) => n === 0)).toBe(true);

    // The other user's encrypted data is still readable.
    const exp = await http().get('/v1/me/export').set('Cookie', other.cookie).expect(200);
    expect(JSON.parse(exp.text).reflection.days[0].intention).toBe('intention m-other');

    // Signing in again with the same email starts a brand-new, empty account.
    const again = await signIn(app, mailer, email);
    const me = await http().get('/v1/me').set('Cookie', again.cookie).expect(200);
    expect(me.body.id).not.toBe(userId);
  });

  it('if the hard delete is interrupted, the account is unusable and the purge job finishes it', async () => {
    const { cookie, email, userId } = await setup('m-purge');
    // Simulate step 1 having run without step 2.
    await h.pool.query(
      `update auth.users set status = 'pending_deletion', deletion_requested_at = now() where id = $1`,
      [userId],
    );
    await h.pool.query(`delete from app.user_keys where user_id = $1`, [userId]);
    await http().get('/v1/me').set('Cookie', cookie).expect(401);

    const purge = await http()
      .get('/v1/internal/cron/purge')
      .set('authorization', `Bearer ${TEST_CRON_SECRET}`)
      .expect(200);
    expect(purge.body.deletedAccounts).toBeGreaterThanOrEqual(1);
    expect(Object.values(await rowsFor(userId)).every((n) => n === 0)).toBe(true);

    // And a pending account is never signed back into.
    const again = await signIn(app, mailer, email);
    expect((await http().get('/v1/me').set('Cookie', again.cookie).expect(200)).body.id).not.toBe(
      userId,
    );
  });
});
