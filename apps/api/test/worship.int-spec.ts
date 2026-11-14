import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays } from '@tadhkirah/domain';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
type Activity = {
  id: string;
  catalogKey: string | null;
  obligation: string;
  enabled: boolean;
  measure: string;
};

describe('worship tracker (M3)', () => {
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
    const list = await http().get('/v1/worship/activities').set('Cookie', cookie).expect(200);
    const acts: Activity[] = list.body;
    const byKey = (k: string) => acts.find((a) => a.catalogKey === k)!;
    const meta = await http()
      .get('/v1/worship/logs?from=2026-01-01&to=2026-01-02')
      .set('Cookie', cookie)
      .expect(200);
    return { cookie, acts, byKey, today: meta.body.today as string };
  }

  const put = (cookie: string, date: string, activityId: string, body: object) =>
    http()
      .put(`/v1/worship/logs/${date}/${activityId}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ id: randomUUID(), clientUpdatedAt: new Date().toISOString(), ...body });

  it('provisions the catalog: five obligatory prayers, voluntary acts labelled voluntary', async () => {
    const { acts, byKey } = await setup();
    expect(acts.length).toBeGreaterThanOrEqual(15);
    expect(acts.filter((a) => a.obligation === 'obligatory').map((a) => a.catalogKey)).toEqual([
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ]);
    expect(byKey('witr')).toMatchObject({ obligation: 'voluntary', enabled: true });
    expect(byKey('duha')).toMatchObject({ obligation: 'voluntary', enabled: false });
  });

  it('logs prayers idempotently, with last-write-wins across devices', async () => {
    const { cookie, byKey, today } = await setup();
    const fajr = byKey('fajr').id;
    const id = randomUUID();
    const t1 = '2026-11-14T05:00:00.000Z';
    await put(cookie, today, fajr, { id, prayerStatus: 'on_time', clientUpdatedAt: t1 }).expect(
      200,
    );
    await put(cookie, today, fajr, { id, prayerStatus: 'on_time', clientUpdatedAt: t1 }).expect(
      200,
    ); // retry

    const newer = await put(cookie, today, fajr, {
      prayerStatus: 'later',
      clientUpdatedAt: '2026-11-14T06:00:00.000Z',
    }).expect(200);
    expect(newer.body.prayerStatus).toBe('later');

    // A stale write from an offline device doesn't overwrite the newer value.
    const stale = await put(cookie, today, fajr, {
      prayerStatus: 'qada',
      clientUpdatedAt: '2026-11-14T04:00:00.000Z',
    }).expect(200);
    expect(stale.body.prayerStatus).toBe('later');

    const logs = await http()
      .get(`/v1/worship/logs?from=${today}&to=${today}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(logs.body.logs).toHaveLength(1);

    await http()
      .delete(`/v1/worship/logs/${today}/${fajr}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .expect(204);
  });

  it('checks the value matches the activity, within limits', async () => {
    const { cookie, byKey, today } = await setup();
    const mismatch = await put(cookie, today, byKey('fajr').id, { done: true }).expect(422);
    expect(mismatch.body.code).toBe('worship.measure_mismatch');
    await put(cookie, today, byKey('after_prayer_adhkar').id, { amount: 6 }).expect(422);
    await put(cookie, today, byKey('after_prayer_adhkar').id, { amount: 5 }).expect(200);
    await put(cookie, today, byKey('witr').id, { done: true, amount: 1 }).expect(400);
  });

  it('allows today and the last 7 days only (WOR-8)', async () => {
    const { cookie, byKey, today } = await setup();
    const witr = byKey('witr').id;
    await put(cookie, addDays(today, -7), witr, { done: true }).expect(200);
    const old = await put(cookie, addDays(today, -8), witr, { done: true }).expect(422);
    expect(old.body.code).toBe('worship.outside_backfill_window');
    await put(cookie, addDays(today, 1), witr, { done: true }).expect(422);
  });

  it('saves day flags (excused / travelling) and returns them with logs', async () => {
    const { cookie, today } = await setup();
    await http()
      .put(`/v1/worship/day-flags/${today}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ excused: true, travelling: false })
      .expect(200);
    const logs = await http()
      .get(`/v1/worship/logs?from=${addDays(today, -6)}&to=${today}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(logs.body.flags).toEqual([{ localDate: today, excused: true, travelling: false }]);
  });

  it('custom activities: always voluntary, goals allowed, archived on removal', async () => {
    const { cookie, today } = await setup();
    const created = await http()
      .post('/v1/worship/activities')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ name: 'Istighfar', measure: 'count', dailyTarget: 100 })
      .expect(201);
    expect(created.body).toMatchObject({
      obligation: 'voluntary',
      category: 'custom',
      unit: 'times',
      dailyTarget: 100,
    });
    const id = created.body.id;
    await put(cookie, today, id, { amount: 33 }).expect(200);
    await http()
      .patch(`/v1/worship/activities/${id}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ name: 'Istighfar (morning)' })
      .expect(200);
    await http().delete(`/v1/worship/activities/${id}`).set('Cookie', cookie).set(CSRF).expect(204);
    const list = await http().get('/v1/worship/activities').set('Cookie', cookie).expect(200);
    expect(list.body.find((a: Activity) => a.id === id)).toBeUndefined();
  });

  it('protects obligatory acts: no goals, always daily, and built-ins are disabled rather than removed', async () => {
    const { cookie, byKey } = await setup();
    const fajr = byKey('fajr').id;
    const patch = (body: object) =>
      http().patch(`/v1/worship/activities/${fajr}`).set('Cookie', cookie).set(CSRF).send(body);
    expect((await patch({ dailyTarget: 2 }).expect(422)).body.code).toBe(
      'worship.target_on_obligatory',
    );
    expect((await patch({ schedule: { type: 'weekdays', days: [5] } }).expect(422)).body.code).toBe(
      'worship.obligatory_schedule',
    );
    await http()
      .delete(`/v1/worship/activities/${fajr}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .expect(422);
  });

  it('reorders activities', async () => {
    const { cookie, acts } = await setup();
    const ids = acts.map((a) => a.id).reverse();
    const res = await http()
      .put('/v1/worship/activities/order')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ ids })
      .expect(200);
    expect(res.body.map((a: Activity) => a.id)).toEqual(ids);
  });

  it("one user can't log against another user's activity (RLS)", async () => {
    const a = await setup();
    const b = await setup();
    const res = await put(b.cookie, b.today, a.byKey('fajr').id, { prayerStatus: 'on_time' });
    expect(res.status).toBe(404);
  });
});
