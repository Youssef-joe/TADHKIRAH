import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays, monthDates, monthOf, shiftMonth, toHijri } from '@tadhkirah/domain';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
type Act = { id: string; catalogKey: string | null };

describe('weekly report, review and goals (M7)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
  });
  afterAll(async () => {
    await app?.close();
  });

  /** A user who can edit 30 days back, looking at last week (a full past week). */
  async function setup() {
    const { cookie } = await signIn(app, mailer);
    await http()
      .patch('/v1/me/preferences')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ backfillDays: 30 })
      .expect(200);
    const acts: Act[] = (
      await http().get('/v1/worship/activities').set('Cookie', cookie).expect(200)
    ).body;
    const current = await http().get('/v1/reports/weekly').set('Cookie', cookie).expect(200);
    const lastWeek = addDays(current.body.weekStart, -7);
    return {
      cookie,
      acts,
      id: (k: string) => acts.find((a) => a.catalogKey === k)!.id,
      lastWeek,
      today: current.body.today,
    };
  }
  const log = (cookie: string, date: string, activityId: string, body: object) =>
    http()
      .put(`/v1/worship/logs/${date}/${activityId}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ id: randomUUID(), clientUpdatedAt: new Date().toISOString(), ...body })
      .expect(200);

  it('AC-WOR-excused: an excused day leaves prayer denominators ("X of 6") and shows neutrally', async () => {
    const { cookie, id, lastWeek } = await setup();
    const fajr = id('fajr');
    const statuses = ['on_time', 'on_time', null, 'later', 'on_time', 'qada', null];
    for (const [i, s] of statuses.entries()) {
      if (s) await log(cookie, addDays(lastWeek, i), fajr, { prayerStatus: s });
    }
    await log(cookie, addDays(lastWeek, 6), fajr, { prayerStatus: 'on_time' });
    await http()
      .put(`/v1/worship/day-flags/${addDays(lastWeek, 2)}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ excused: true, travelling: false })
      .expect(200);
    await log(cookie, addDays(lastWeek, 0), id('witr'), { done: true });

    const res = await http()
      .get(`/v1/reports/weekly?weekStart=${lastWeek}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.weekStart).toBe(lastWeek);
    expect(res.body.excusedDays).toBe(1);
    const fajrRow = res.body.activities.find((a: { activityId: string }) => a.activityId === fajr);
    expect(fajrRow).toMatchObject({
      eligible: 6,
      logged: 6,
      excused: 1,
      statusBreakdown: { on_time: 4, later: 1, qada: 1 },
      needsAttention: false,
    });
    expect(fajrRow.perDay[2]).toBe('excused');
    const witr = res.body.activities.find(
      (a: { activityId: string }) => a.activityId === id('witr'),
    );
    // Voluntary prayer is excusable too, so Witr is out of 6 as well.
    expect(witr).toMatchObject({ eligible: 6, logged: 1, needsAttention: true });
  });

  it('never returns a score, percentage or ranking (REP-8)', async () => {
    const { cookie } = await setup();
    const res = await http().get('/v1/reports/weekly').set('Cookie', cookie).expect(200);
    const keys = JSON.stringify(res.body).match(/"([a-zA-Z_]+)":/g) ?? [];
    expect(keys.filter((k) => /score|percent|rank|grade|level/i.test(k))).toEqual([]);
  });

  it('counts Quran pages, revisions and reflections for the week', async () => {
    const { cookie, id, lastWeek } = await setup();
    await log(cookie, addDays(lastWeek, 1), id('quran_pages'), { amount: 4 });
    await log(cookie, addDays(lastWeek, 3), id('quran_pages'), { amount: 6 });
    await http()
      .post('/v1/quran/revisions')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        id: randomUUID(),
        localDate: addDays(lastWeek, 2),
        surah: 67,
        fromAyah: 1,
        toAyah: 30,
      })
      .expect(201);
    await http()
      .put(`/v1/reflections/${addDays(lastWeek, 4)}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ intention: 'x', complete: true })
      .expect(200);

    const res = await http()
      .get(`/v1/reports/weekly?weekStart=${lastWeek}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.quran).toMatchObject({
      pages: 10,
      recitationDays: 2,
      revisedAyahs: 30,
      revisions: 1,
    });
    expect(res.body.reflections).toMatchObject({ written: 1, completed: 1 });
    expect(res.body.reflections.perDay[4]).toBe(true);
  });

  it('saves the weekly review (encrypted) and turns "what should change" into next week’s goal', async () => {
    const { cookie, lastWeek } = await setup();
    const saved = await http()
      .put(`/v1/weekly-reviews/${lastWeek}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        improved: 'Fajr on time',
        neglected: 'Witr',
        madeEasier: 'sleeping early',
        changeNext: 'pray Witr before sleeping',
        makeGoal: true,
      })
      .expect(200);
    expect(saved.body).toMatchObject({ weekStart: lastWeek, neglected: 'Witr' });

    const goals = await http().get('/v1/goals?status=active').set('Cookie', cookie).expect(200);
    expect(goals.body).toHaveLength(1);
    expect(goals.body[0]).toMatchObject({
      text: 'pray Witr before sleeping',
      source: 'weekly_review',
      startsOn: addDays(lastWeek, 7),
      endsOn: addDays(lastWeek, 13),
    });

    const report = await http()
      .get(`/v1/reports/weekly?weekStart=${lastWeek}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(report.body.reviewSaved).toBe(true);

    const letGo = await http()
      .patch(`/v1/goals/${goals.body[0].id}`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ status: 'let_go' })
      .expect(200);
    expect(letGo.body.status).toBe('let_go');
  });

  it('refuses weeks that have not started yet', async () => {
    const { cookie, today } = await setup();
    const res = await http()
      .get(`/v1/reports/weekly?weekStart=${addDays(today, 8)}`)
      .set('Cookie', cookie)
      .expect(422);
    expect(res.body.code).toBe('reports.future_week');
  });

  describe('monthly report (REP-7)', () => {
    /** Logs Fajr on up to three editable days of `month`, returning the dates. */
    async function logIn(
      ctx: Awaited<ReturnType<typeof setup>>,
      month: string,
      calendar: 'gregorian' | 'hijri',
    ) {
      const earliest = addDays(ctx.today, -29);
      const dates = monthDates(month, calendar)
        .filter((d) => d >= earliest && d <= ctx.today)
        .slice(0, 3);
      for (const d of dates) await log(ctx.cookie, d, ctx.id('fajr'), { prayerStatus: 'on_time' });
      return dates;
    }

    for (const calendar of ['gregorian', 'hijri'] as const) {
      it(`counts a whole ${calendar} month, with one calendar cell per day`, async () => {
        const ctx = await setup();
        const month = monthOf(addDays(ctx.today, -15), calendar);
        const dates = await logIn(ctx, month, calendar);
        const res = await http()
          .get(`/v1/reports/monthly?calendar=${calendar}&month=${month}`)
          .set('Cookie', ctx.cookie)
          .expect(200);
        const days = monthDates(month, calendar);
        expect(res.body).toMatchObject({ calendar, month, start: days[0], end: days.at(-1) });
        expect(res.body.days).toEqual(days);
        const fajr = res.body.activities.find(
          (a: { activityId: string }) => a.activityId === ctx.id('fajr'),
        );
        expect(fajr.logged).toBe(dates.length);
        expect(fajr.statusBreakdown.on_time).toBe(dates.length);
        expect(fajr.perDay).toHaveLength(days.length);
        expect(res.body.reflections.perDay).toHaveLength(days.length);
        if (calendar === 'hijri') {
          const [y, m] = month.split('-').map(Number);
          for (const d of [days[0]!, days.at(-1)!])
            expect(toHijri(d)).toMatchObject({ year: y, month: m });
        }
      });
    }

    it('defaults to the current month and never returns a score (REP-8)', async () => {
      const { cookie, today } = await setup();
      const res = await http()
        .get('/v1/reports/monthly?calendar=hijri')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.month).toBe(monthOf(today, 'hijri'));
      expect(res.body.isCurrentMonth).toBe(true);
      expect(res.body.days).toContain(today);
      const keys = JSON.stringify(res.body).match(/"([a-zA-Z_]+)":/g) ?? [];
      expect(keys.filter((k) => /score|percent|rank|grade|level/i.test(k))).toEqual([]);
    });

    it('counts weekly reviews saved in the month, without their text', async () => {
      const { cookie, lastWeek } = await setup();
      await http()
        .put(`/v1/weekly-reviews/${lastWeek}`)
        .set('Cookie', cookie)
        .set(CSRF)
        .send({ improved: 'private words' })
        .expect(200);
      const res = await http()
        .get(`/v1/reports/monthly?month=${monthOf(lastWeek, 'gregorian')}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.reviewsSaved).toBe(1);
      expect(JSON.stringify(res.body)).not.toContain('private words');
    });

    it('refuses months that have not started, and malformed months', async () => {
      const { cookie, today } = await setup();
      const next = shiftMonth(monthOf(today, 'gregorian'), 1);
      const res = await http()
        .get(`/v1/reports/monthly?month=${next}`)
        .set('Cookie', cookie)
        .expect(422);
      expect(res.body.code).toBe('reports.future_month');
      await http().get('/v1/reports/monthly?month=2026-13').set('Cookie', cookie).expect(400);
      await http().get('/v1/reports/monthly?calendar=julian').set('Cookie', cookie).expect(400);
    });
  });
});
