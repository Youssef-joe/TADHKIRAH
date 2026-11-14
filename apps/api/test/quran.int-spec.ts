import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays } from '@tadhkirah/domain';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };

describe('Quran progress (M4)', () => {
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
    const summary = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    return { cookie, today: summary.body.today as string };
  }
  const post = (cookie: string, path: string, body: object) =>
    http()
      .post(`/v1/quran/${path}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ id: randomUUID(), ...body });

  it('starts empty, out of 6,236 ayahs', async () => {
    const { cookie } = await setup();
    const s = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    expect(s.body).toMatchObject({
      totalAyahs: 6236,
      memorizedAyahs: 0,
      memorizedSurahs: 0,
      revisionDue: [],
    });
  });

  it('logs recitation by pages and by range, and syncs pages into the Today Quran portion', async () => {
    const { cookie, today } = await setup();
    // Provision worship activities, as opening the Today page would.
    const acts = await http().get('/v1/worship/activities').set('Cookie', cookie).expect(200);
    const quranPages = acts.body.find(
      (a: { catalogKey: string }) => a.catalogKey === 'quran_pages',
    );

    await post(cookie, 'recitations', { localDate: today, pages: 4 }).expect(201);
    await post(cookie, 'recitations', {
      localDate: today,
      pages: 2,
      from: { surah: 2, ayah: 1 },
      to: { surah: 2, ayah: 25 },
    }).expect(201);

    const logs = await http()
      .get(`/v1/worship/logs?from=${today}&to=${today}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(
      logs.body.logs.find((l: { activityId: string }) => l.activityId === quranPages.id).amount,
    ).toBe(6);

    const s = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    expect(s.body.recentRecitations).toHaveLength(2);
  });

  it('rejects ayahs that do not exist and reversed ranges', async () => {
    const { cookie, today } = await setup();
    const bad = await post(cookie, 'recitations', {
      localDate: today,
      from: { surah: 1, ayah: 1 },
      to: { surah: 1, ayah: 8 }, // Al-Fatihah has 7
    }).expect(422);
    expect(bad.body.code).toBe('quran.invalid_reference');
    await post(cookie, 'recitations', {
      localDate: today,
      from: { surah: 3, ayah: 1 },
      to: { surah: 2, ayah: 1 },
    }).expect(422);
    await post(cookie, 'recitations', { localDate: today }).expect(400);
    await post(cookie, 'recitations', { localDate: addDays(today, -8), pages: 1 }).expect(422);
  });

  it('is safe to repeat: the same recitation id twice is stored once', async () => {
    const { cookie, today } = await setup();
    const id = randomUUID();
    await post(cookie, 'recitations', { id, localDate: today, pages: 1 }).expect(201);
    await post(cookie, 'recitations', { id, localDate: today, pages: 1 }).expect(201);
    const s = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    expect(s.body.recentRecitations).toHaveLength(1);
  });

  it('tracks memorization with merged ranges and inferred status', async () => {
    const { cookie } = await setup();
    const put = (surah: number, body: object) =>
      http().put(`/v1/quran/memorization/${surah}`).set('Cookie', cookie).set(CSRF).send(body);

    const partial = await put(67, {
      status: 'in_progress',
      ranges: [
        [1, 10],
        [8, 15],
      ],
    }).expect(200);
    expect(partial.body).toMatchObject({ status: 'in_progress', ranges: [[1, 15]] });
    const full = await put(67, {
      status: 'in_progress',
      ranges: [
        [1, 15],
        [16, 30],
      ],
    }).expect(200);
    expect(full.body).toMatchObject({ status: 'memorized', ranges: [[1, 30]] });
    await put(114, { status: 'memorized' }).expect(200);
    await put(1, { status: 'in_progress', ranges: [[1, 9]] }).expect(422);
    await put(115, { status: 'memorized' }).expect(404);

    const s = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    expect(s.body).toMatchObject({ memorizedSurahs: 2, memorizedAyahs: 36 });
    // Never revised → both are due, never-revised first then by number.
    expect(s.body.revisionDue.map((d: { surah: number }) => d.surah)).toEqual([67, 114]);
  });

  it('logging a revision updates "last revised" and removes it from the due list', async () => {
    const { cookie, today } = await setup();
    await http()
      .put('/v1/quran/memorization/78')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ status: 'memorized' })
      .expect(200);
    const rev = await post(cookie, 'revisions', {
      localDate: today,
      surah: 78,
      fromAyah: 1,
      toAyah: 40,
      quality: 'smooth',
    }).expect(201);

    let s = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    expect(s.body.memorization.find((m: { surah: number }) => m.surah === 78).lastRevisedOn).toBe(
      today,
    );
    expect(s.body.revisionDue).toEqual([]);

    await http()
      .delete(`/v1/quran/revisions/${rev.body.id}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .expect(204);
    s = await http().get('/v1/quran/summary').set('Cookie', cookie).expect(200);
    expect(
      s.body.memorization.find((m: { surah: number }) => m.surah === 78).lastRevisedOn,
    ).toBeNull();

    await post(cookie, 'revisions', {
      localDate: today,
      surah: 78,
      fromAyah: 1,
      toAyah: 41,
    }).expect(422);
  });
});
