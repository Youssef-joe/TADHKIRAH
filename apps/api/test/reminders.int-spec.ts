import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inject } from 'vitest';
import { createDb, schema, sql, withSystem, withUser, type DbHandle } from '@tadhkirah/db';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { PUSH_CHANNEL, type MemoryPushChannel } from '../src/reminders/push.channel.js';
import { signIn, startApp, TEST_CRON_SECRET } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
const CRON = { authorization: `Bearer ${TEST_CRON_SECRET}` };
type Rule = {
  id: string;
  category: string;
  enabled: boolean;
  timing: { type: string; prayer?: string };
};

describe('reminders: planning, dispatch, inbox, snooze (M6)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  let push: MemoryPushChannel;
  let h: DbHandle;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
    push = app.get<MemoryPushChannel>(PUSH_CHANNEL);
    h = createDb(inject('databaseUrl'));
  });
  afterAll(async () => {
    await h?.close();
    await app?.close();
  });

  /** An onboarded user in Riyadh, so prayer-relative reminders can be planned. */
  async function setup() {
    const { cookie } = await signIn(app, mailer);
    await http()
      .post('/v1/me/onboarding')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        timezone: 'Asia/Riyadh',
        locale: 'ar',
        prayerSettings: {
          latitude: 24.71,
          longitude: 46.68,
          locationLabel: 'Riyadh',
          countryCode: 'SA',
          method: 'UmmAlQura',
        },
      })
      .expect(204);
    const me = await http().get('/v1/me').set('Cookie', cookie).expect(200);
    const rules: Rule[] = (
      await http().get('/v1/reminders/rules').set('Cookie', cookie).expect(200)
    ).body;
    return { cookie, userId: me.body.id as string, rules };
  }

  /** Inserts a reminder due at `minutesAgo`, as the planner would have. */
  async function due(userId: string, ruleId: string, minutesAgo: number) {
    const fireAt = new Date(Math.floor((Date.now() - minutesAgo * 60_000) / 1000) * 1000);
    const [row] = await withSystem(h.db, (tx) =>
      tx.insert(schema.scheduledReminders).values({ userId, ruleId, fireAt }).returning(),
    );
    return row!;
  }

  it('provisions default rules: only the reflection and weekly review reminders are on', async () => {
    const { rules } = await setup();
    expect(rules).toHaveLength(10);
    expect(
      rules
        .filter((r) => r.enabled)
        .map((r) => r.category)
        .sort(),
    ).toEqual(['reflection', 'weekly_review']);
  });

  it('plans idempotently: re-running the planner adds nothing (AC-NOT-idempotent)', async () => {
    const { cookie } = await setup();
    await http().get('/v1/internal/cron/plan').set(CRON).expect(200);
    const first = (await http().get('/v1/reminders/upcoming').set('Cookie', cookie).expect(200))
      .body;
    expect(first.length).toBeGreaterThan(0);
    // Force a second pass by expiring the horizon, then plan again.
    await h.db.execute(sql`update auth.users set plan_horizon = now()`);
    await http().get('/v1/internal/cron/plan').set(CRON).expect(200);
    const second = (await http().get('/v1/reminders/upcoming').set('Cookie', cookie).expect(200))
      .body;
    expect(second.map((r: { id: string }) => r.id).sort()).toEqual(
      first.map((r: { id: string }) => r.id).sort(),
    );
  });

  it('suppresses reminders inside quiet hours (AC-NOT-quiet)', async () => {
    const { cookie } = await setup();
    // Quiet all day except one minute: everything not explicitly allowed is suppressed.
    await http()
      .put('/v1/me/notification-preferences')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ enabled: true, quietStart: '00:00', quietEnd: '23:59', dailyCap: 6 })
      .expect(200);
    const upcoming = (await http().get('/v1/reminders/upcoming').set('Cookie', cookie).expect(200))
      .body;
    const reflection = upcoming.filter((r: { category: string }) => r.category === 'reflection');
    expect(reflection.length).toBeGreaterThan(0);
    expect(
      reflection.every(
        (r: { status: string; suppressReason: string }) =>
          r.status === 'suppressed' && r.suppressReason === 'quiet_hours',
      ),
    ).toBe(true);
  });

  it('dispatches due reminders once, to push and the inbox, and drops stale ones', async () => {
    const { cookie, userId, rules } = await setup();
    await http()
      .post('/v1/devices')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        endpoint: `https://push.example/${userId}`,
        keys: { p256dh: 'p256dh-key-0123456789', auth: 'auth-key-01' },
      })
      .expect(201);
    const reflection = rules.find((r) => r.category === 'reflection')!;
    const fresh = await due(userId, reflection.id, 1);
    const stale = await due(userId, reflection.id, 20);

    push.sent.length = 0;
    await http().get('/v1/internal/cron/dispatch').set(CRON).expect(200);
    const mine = push.sent.filter((p) => p.target.endpoint === `https://push.example/${userId}`);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.payload).toMatchObject({
      title: 'لَحْظَةٌ لِمُحَاسَبَةِ النَّفْس',
      url: '/ar/app/reflection',
      scheduledId: fresh.id,
    });

    // A second run never re-sends.
    await http().get('/v1/internal/cron/dispatch').set(CRON).expect(200);
    expect(
      push.sent.filter((p) => p.target.endpoint === `https://push.example/${userId}`),
    ).toHaveLength(1);

    const inbox = (await http().get('/v1/notifications').set('Cookie', cookie).expect(200)).body;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      category: 'reflection',
      scheduledId: fresh.id,
      openedAt: null,
    });

    const [staleRow] = await withSystem(h.db, (tx) =>
      tx
        .select()
        .from(schema.scheduledReminders)
        .where(sql`${schema.scheduledReminders.id} = ${stale.id}`),
    );
    expect(staleRow!.status).toBe('expired');
  });

  it('disables devices the push service says are gone', async () => {
    const { cookie, userId, rules } = await setup();
    const endpoint = `https://push.example/gone-${userId}`;
    await http()
      .post('/v1/devices')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ endpoint, keys: { p256dh: 'p256dh-key-0123456789', auth: 'auth-key-01' } })
      .expect(201);
    push.goneEndpoints.add(endpoint);
    await due(userId, rules.find((r) => r.category === 'reflection')!.id, 1);
    await http().get('/v1/internal/cron/dispatch').set(CRON).expect(200);
    const devices = (await http().get('/v1/devices').set('Cookie', cookie).expect(200)).body;
    expect(devices).toEqual([expect.objectContaining({ endpoint, active: false })]);
  });

  it('custom reminders: encrypted title, delivered decrypted; snooze schedules a follow-up', async () => {
    const { cookie, userId } = await setup();
    await http()
      .post('/v1/devices')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({
        endpoint: `https://push.example/c-${userId}`,
        keys: { p256dh: 'p256dh-key-0123456789', auth: 'auth-key-01' },
      })
      .expect(201);
    const custom = await http()
      .post('/v1/reminders/rules')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ customTitle: 'Call my mother', timing: { type: 'fixed', time: '18:00' } })
      .expect(201);
    expect(custom.body.customTitle).toBe('Call my mother');
    const [raw] = await withSystem(h.db, (tx) =>
      tx
        .select()
        .from(schema.reminderRules)
        .where(sql`${schema.reminderRules.id} = ${custom.body.id}`),
    );
    expect(raw!.customTitleCt!.includes(Buffer.from('Call my mother'))).toBe(false);

    const s = await due(userId, custom.body.id, 1);
    await http().get('/v1/internal/cron/dispatch').set(CRON).expect(200);
    expect(
      push.sent.find((p) => p.target.endpoint === `https://push.example/c-${userId}`)!.payload
        .title,
    ).toBe('Call my mother');

    const snoozed = await http()
      .post(`/v1/reminders/${s.id}/snooze`)
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ minutes: 10 })
      .expect(201);
    const minutes = (Date.parse(snoozed.body.fireAt) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThan(11.1);
  });

  it('a time zone change marks the user for re-planning (AC-TZ)', async () => {
    const { cookie, userId } = await setup();
    await http().get('/v1/internal/cron/plan').set(CRON).expect(200);
    await http()
      .patch('/v1/me/profile')
      .set('Cookie', cookie)
      .set(CSRF)
      .send({ timezone: 'Europe/London' })
      .expect(200);
    const { rows } = await h.pool.query('select plan_horizon from auth.users where id = $1', [
      userId,
    ]);
    expect(rows[0].plan_horizon).toBeNull();
    await http().get('/v1/internal/cron/plan').set(CRON).expect(200);
    const after = await h.pool.query('select plan_horizon from auth.users where id = $1', [userId]);
    expect(after.rows[0].plan_horizon).not.toBeNull();
  });

  it('cron endpoints need the secret, and the system policy cannot be used from a user session', async () => {
    await http().get('/v1/internal/cron/dispatch').expect(401);
    const a = await setup();
    const b = await setup();
    await due(b.userId, b.rules[0]!.id, -60);
    const visible = await withUser(h.db, a.userId, async (tx) => {
      await tx.execute(sql`select set_config('app.system', 'on', true)`);
      return tx
        .select()
        .from(schema.scheduledReminders)
        .where(sql`${schema.scheduledReminders.userId} = ${b.userId}`);
    });
    expect(visible).toEqual([]);
  });
});
