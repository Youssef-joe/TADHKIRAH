import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { inject } from 'vitest';
import { addDays } from '@tadhkirah/domain';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
type Q = { id: string; catalogKey: string | null; text: string | null; enabled: boolean };

describe('daily reflection with encryption (M5)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
  });
  afterAll(async () => {
    await app?.close();
  });

  async function setup() {
    const { cookie } = await signIn(app, mailer);
    const meta = await http()
      .get('/v1/worship/logs?from=2026-01-01&to=2026-01-01')
      .set('Cookie', cookie)
      .expect(200);
    const today = meta.body.today as string;
    const day = await http().get(`/v1/reflections/${today}`).set('Cookie', cookie).expect(200);
    const qs: Q[] = day.body.questions;
    return { cookie, today, qs, q: (k: string) => qs.find((x) => x.catalogKey === k)! };
  }
  const save = (cookie: string, date: string, body: object) =>
    http().put(`/v1/reflections/${date}`).set('Cookie', cookie).set(CSRF).send(body);

  it('provisions the default questions; a new day has no reflection yet', async () => {
    const { cookie, today, qs } = await setup();
    expect(qs.map((x) => x.catalogKey)).toEqual([
      'prayers_on_time',
      'quran_portion',
      'adhkar',
      'remembrance',
      'tongue',
      'rights',
      'good_deed',
    ]);
    const day = await http().get(`/v1/reflections/${today}`).set('Cookie', cookie).expect(200);
    expect(day.body.reflection).toBeNull();
    expect(day.headers['cache-control']).toBe('no-store');
  });

  it('saves and returns the full reflection, and the database holds only ciphertext (AC-REF-privacy)', async () => {
    const { cookie, today, q } = await setup();
    const secret = 'سِرٌّ بَيْنِي وَبَيْنَ رَبِّي — private-marker-7f3a';
    const res = await save(cookie, today, {
      answers: [
        { questionId: q('remembrance').id, choice: 'partly' },
        { questionId: q('good_deed').id, text: `helped my neighbour ${secret}` },
      ],
      gratitude: ['family', `health ${secret}`],
      shortcoming: `lost my temper ${secret}`,
      repentanceNoted: true,
      intention: `pray Duha ${secret}`,
      freeText: secret,
      complete: true,
    }).expect(200);
    expect(res.body).toMatchObject({
      version: 1,
      gratitude: ['family', `health ${secret}`],
      shortcoming: `lost my temper ${secret}`,
      repentanceNoted: true,
      intention: `pray Duha ${secret}`,
      freeText: secret,
    });
    expect(res.body.completedAt).not.toBeNull();
    expect(res.body.answers).toHaveLength(2);

    // Read the raw tables directly, as an attacker with a database dump would.
    const c = new pg.Client({ connectionString: inject('databaseUrl') });
    await c.connect();
    try {
      for (const table of ['app.daily_reflections', 'app.reflection_answers', 'app.user_keys']) {
        const { rows } = await c.query(`select * from ${table}`);
        const dump = JSON.stringify(rows, (_k, v) =>
          v?.type === 'Buffer' ? Buffer.from(v.data).toString('latin1') : v,
        );
        expect(dump.includes('private-marker-7f3a'), table).toBe(false);
        expect(
          Buffer.from(dump, 'latin1').includes(Buffer.from('private-marker-7f3a')),
          table,
        ).toBe(false);
      }
    } finally {
      await c.end();
    }
  });

  it('every question is optional: only an intention is a valid reflection (AC-REF-skip)', async () => {
    const { cookie, today } = await setup();
    const res = await save(cookie, today, { intention: 'be patient', complete: true }).expect(200);
    expect(res.body).toMatchObject({ answers: [], gratitude: [], intention: 'be patient' });
    const list = await http()
      .get(`/v1/reflections?from=${today}&to=${today}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toEqual([
      { localDate: today, completedAt: expect.any(String), answeredCount: 0 },
    ]);
    expect(JSON.stringify(list.body)).not.toContain('patient');
  });

  it('detects edits from another device (version conflict) and never un-completes', async () => {
    const { cookie, today } = await setup();
    const first = await save(cookie, today, { intention: 'a', complete: true }).expect(200);
    await save(cookie, today, { version: first.body.version, intention: 'b' }).expect(200);
    const stale = await save(cookie, today, { version: first.body.version, intention: 'c' }).expect(
      409,
    );
    expect(stale.body.code).toBe('reflection.version_conflict');
    const day = await http().get(`/v1/reflections/${today}`).set('Cookie', cookie).expect(200);
    expect(day.body.reflection).toMatchObject({ version: 2, intention: 'b' });
    expect(day.body.reflection.completedAt).not.toBeNull();
  });

  it("shows yesterday's intention for today's page", async () => {
    const { cookie, today } = await setup();
    const yesterday = addDays(today, -1);
    await save(cookie, yesterday, { intention: 'read Surat Al-Kahf' }).expect(200);
    const res = await http()
      .get(`/v1/reflections/${yesterday}/intention`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toEqual({ localDate: yesterday, intention: 'read Surat Al-Kahf' });
  });

  it('suggests answers from the worship log, never "no" from an empty log', async () => {
    const { cookie, today, q } = await setup();
    let day = await http().get(`/v1/reflections/${today}`).set('Cookie', cookie).expect(200);
    expect(day.body.suggestions).toEqual({});

    const acts = (await http().get('/v1/worship/activities').set('Cookie', cookie)).body as {
      id: string;
      catalogKey: string;
    }[];
    for (const k of ['fajr', 'dhuhr']) {
      await http()
        .put(`/v1/worship/logs/${today}/${acts.find((a) => a.catalogKey === k)!.id}`)
        .set('Cookie', cookie)
        .set(CSRF)
        .send({
          id: randomUUID(),
          prayerStatus: 'on_time',
          clientUpdatedAt: new Date().toISOString(),
        })
        .expect(200);
    }
    day = await http().get(`/v1/reflections/${today}`).set('Cookie', cookie).expect(200);
    expect(day.body.suggestions).toEqual({ [q('prayers_on_time').id]: 'partly' });
  });

  it('custom questions: text is encrypted, built-ins can only be hidden', async () => {
    const { cookie, q } = await setup();
    const created = await http()
      .post('/v1/reflection/questions')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ text: 'Did I call my mother?' })
      .expect(201);
    expect(created.body).toMatchObject({
      catalogKey: null,
      text: 'Did I call my mother?',
      enabled: true,
    });

    await http()
      .patch(`/v1/reflection/questions/${q('tongue').id}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ enabled: false })
      .expect(200);
    await http()
      .patch(`/v1/reflection/questions/${q('tongue').id}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ text: 'changed' })
      .expect(422);
    await http()
      .delete(`/v1/reflection/questions/${created.body.id}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .expect(204);
  });

  it("isolates users: another user's question ids are ignored, and the 7-day window applies", async () => {
    const a = await setup();
    const b = await setup();
    const res = await save(b.cookie, b.today, {
      answers: [{ questionId: a.q('remembrance').id, choice: 'yes' }],
      intention: 'x',
    }).expect(200);
    expect(res.body.answers).toEqual([]);
    await save(a.cookie, addDays(a.today, -8), { intention: 'old' }).expect(422);
    await http()
      .get(`/v1/reflections/${addDays(a.today, 1)}`)
      .set('Cookie', a.cookie)
      .expect(422);
  });
});
