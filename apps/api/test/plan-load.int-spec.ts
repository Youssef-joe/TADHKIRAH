import type { INestApplication } from '@nestjs/common';
import { appendFileSync } from 'node:fs';
import { inject } from 'vitest';
import { createDb, type DbHandle } from '@tadhkirah/db';
import { DispatcherService } from '../src/reminders/dispatcher.service.js';
import { PlannerService } from '../src/reminders/planner.service.js';
import { startApp } from './helpers.js';

/**
 * Reminder load test (M6/M8 hardening), opt-in:
 *   LOAD_USERS=10000 pnpm --filter @tadhkirah/api test:integration plan-load
 * Seeds users across Middle East time zones, then measures the planner in the
 * batches the 5-minute cron uses, and the dispatcher on a burst of due reminders.
 */
const N = Number(process.env.LOAD_USERS ?? 0);
const BATCH = 200;
/** Live progress (vitest buffers console output until the end). */
const progress = (line: string) =>
  process.env.LOAD_LOG && appendFileSync(process.env.LOAD_LOG, `${line}\n`);

describe.skipIf(!N)(`reminder load: ${N} users`, () => {
  let app: INestApplication;
  let h: DbHandle;

  beforeAll(async () => {
    ({ app } = await startApp());
    h = createDb(inject('databaseUrl'));
  }, 120_000);
  afterAll(async () => {
    await h?.close();
    await app?.close();
  });

  async function planAll(label: string) {
    const planner = app.get(PlannerService);
    const now = new Date();
    const batches: number[] = [];
    let users = 0;
    let inserted = 0;
    for (;;) {
      const t = performance.now();
      const r = await planner.planDue(now, BATCH);
      if (!r.users) break;
      batches.push(performance.now() - t);
      progress(
        `${label} batch ${batches.length}: ${Math.round(performance.now() - t)}ms users=${r.users} inserted=${r.inserted}`,
      );
      users += r.users;
      inserted += r.inserted;
    }
    const sorted = [...batches].sort((a, b) => a - b);
    const p = (q: number) =>
      Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!);
    const total = Math.round(batches.reduce((a, b) => a + b, 0));
    console.log(
      `[${label}] users=${users} reminders=${inserted} batches=${batches.length} ` +
        `batch(ms) p50=${p(0.5)} p95=${p(0.95)} max=${p(1)} total=${(total / 1000).toFixed(1)}s ` +
        `per-user=${(total / users).toFixed(1)}ms`,
    );
    return { users, batchP95: p(0.95) };
  }

  it('plans every user within the cron budget, and dispatches a burst', async () => {
    const zones = [
      'Asia/Riyadh',
      'Asia/Dubai',
      'Africa/Cairo',
      'Asia/Amman',
      'Asia/Baghdad',
      'Asia/Kuwait',
    ];
    await h.pool.query(
      `with u as (
         insert into auth.users (email, email_verified_at)
         select 'load-' || g || '-' || $2::text || '@example.com', now() from generate_series(1, $1::int) g
         returning id
       ), numbered as (select id, row_number() over () as n from u),
       p as (
         insert into app.user_profiles (user_id, timezone, onboarded_at)
         select id, ($3::text[])[1 + n % array_length($3::text[], 1)], now() from numbered
         returning user_id
       )
       insert into app.prayer_time_settings (user_id, latitude, longitude, location_label, method)
       select id, 21 + (n % 10), 39 + (n % 12), 'Load', 'UmmAlQura' from numbered`,
      [N, Date.now(), zones],
    );

    // Pass 1: first planning (provisions the default rules; two are on).
    const first = await planAll('defaults');
    expect(first.users).toBeGreaterThanOrEqual(N);

    // Pass 2: everyone turns on all ten reminders; the next run re-plans from scratch.
    await h.pool.query(`update app.reminder_rules set enabled = true`);
    await h.pool.query(`update auth.users set plan_horizon = null where email like 'load-%'`);
    const all = await planAll('all rules on');
    // A batch must finish well inside one cron invocation (the Worker aborts at 55 s).
    expect(all.batchP95).toBeLessThan(30_000);

    // Dispatch: 2000 reminders due right now (no devices → inbox only).
    await h.pool.query(
      // One millisecond apart: (user, rule, fire_at) is unique.
      `update app.scheduled_reminders s
       set fire_at = now() - interval '30 seconds' - x.n * interval '1 millisecond'
       from (select id, row_number() over () as n from app.scheduled_reminders where status = 'pending' limit 2000) x
       where s.id = x.id`,
    );
    const dispatcher = app.get(DispatcherService);
    const t = performance.now();
    let sent = 0;
    for (let i = 0; i < 100; i++) {
      const r = await dispatcher.dispatch();
      if (!r.sent) break;
      sent += r.sent;
      progress(
        `dispatch ${i}: sent=${r.sent} expired=${r.expired} ${Math.round(performance.now() - t)}ms`,
      );
    }
    const ms = performance.now() - t;
    console.log(
      `[dispatch] sent=${sent} in ${(ms / 1000).toFixed(1)}s (${Math.round(sent / (ms / 1000))}/s)`,
    );
    expect(sent).toBeGreaterThanOrEqual(2000);
  }, 1_800_000);
});
