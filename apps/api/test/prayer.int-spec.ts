import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
const RIYADH = {
  latitude: 24.713612,
  longitude: 46.675297,
  locationLabel: 'الرياض',
  countryCode: 'SA',
  method: 'UmmAlQura',
};

describe('prayer settings, onboarding and prayer times (M2)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
  });
  afterAll(async () => {
    await app?.close();
  });

  it('new users are not onboarded and have no prayer settings', async () => {
    const { cookie } = await signIn(app, mailer);
    const me = await http().get('/v1/me').set('Cookie', cookie).expect(200);
    expect(me.body).toMatchObject({ onboarded: false, prayerSettings: null });
    const times = await http().get('/v1/prayer-times').set('Cookie', cookie).expect(409);
    expect(times.body.code).toBe('prayer.settings_missing');
  });

  it('onboarding saves location (rounded to ~1 km), method and time zone', async () => {
    const { cookie } = await signIn(app, mailer);
    await http()
      .post('/v1/me/onboarding')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ timezone: 'Asia/Riyadh', locale: 'ar', prayerSettings: RIYADH })
      .expect(204);

    const me = await http().get('/v1/me').set('Cookie', cookie).expect(200);
    expect(me.body.onboarded).toBe(true);
    expect(me.body.profile.timezone).toBe('Asia/Riyadh');
    expect(me.body.prayerSettings).toEqual({
      latitude: 24.71,
      longitude: 46.68,
      locationLabel: 'الرياض',
      countryCode: 'SA',
      method: 'UmmAlQura',
      asrMethod: 'standard',
      highLatRule: null,
      adjustments: {},
      jumuahKhutbahTime: null,
    });
  });

  it('returns prayer times and windows for the current tracking day and a range', async () => {
    const { cookie } = await signIn(app, mailer);
    await http()
      .post('/v1/me/onboarding')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ timezone: 'Asia/Riyadh', prayerSettings: RIYADH })
      .expect(204);

    const today = await http().get('/v1/prayer-times').set('Cookie', cookie).expect(200);
    expect(today.body.timeZone).toBe('Asia/Riyadh');
    expect(today.body.days).toHaveLength(1);
    expect(today.body.days[0].date).toBe(today.body.today);
    const t = today.body.days[0].times;
    expect(new Date(t.fajr) < new Date(t.dhuhr) && new Date(t.dhuhr) < new Date(t.isha)).toBe(true);
    expect(today.body.days[0].windows.lastThirdOfNight.end).toBeDefined();

    const week = await http()
      .get('/v1/prayer-times?from=2026-11-13&to=2026-11-19')
      .set('Cookie', cookie)
      .expect(200);
    expect(week.body.days).toHaveLength(7);
    expect(week.body.days[0].windows.jumuah).toBeDefined(); // 13 Nov 2026 is a Friday
    expect(week.body.days[1].windows.jumuah).toBeUndefined();
    expect(week.body.days[0].hijri.year).toBe(1448);

    await http()
      .get('/v1/prayer-times?from=2026-11-01&to=2026-12-15')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('updates settings with Hanafi Asr, adjustments and khutbah time', async () => {
    const { cookie } = await signIn(app, mailer);
    const res = await http()
      .put('/v1/me/prayer-settings')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        ...RIYADH,
        asrMethod: 'hanafi',
        adjustments: { fajr: 2 },
        jumuahKhutbahTime: '11:45',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      asrMethod: 'hanafi',
      adjustments: { fajr: 2 },
      jumuahKhutbahTime: '11:45',
    });
  });

  it('rejects invalid settings', async () => {
    const { cookie } = await signIn(app, mailer);
    const put = (body: object) =>
      http().put('/v1/me/prayer-settings').set('Cookie', cookie).set(CSRF).send(body);
    await put({ ...RIYADH, method: 'Invented' }).expect(400);
    await put({ ...RIYADH, latitude: 95 }).expect(400);
    await put({ ...RIYADH, adjustments: { fajr: 90 } }).expect(400);
    await put({ ...RIYADH, jumuahKhutbahTime: '25:00' }).expect(400);
  });
});
