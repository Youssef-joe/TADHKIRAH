import { describe, expect, it } from 'vitest';
import { wallClock } from '../calendar/dates.js';
import { computePrayerTimes, type PrayerLocation } from '../prayer/prayer-times.js';
import { defaultRules, fireTime, inQuietHours, planReminders, type RuleLike } from './plan.js';

const riyadh: PrayerLocation = {
  latitude: 24.71,
  longitude: 46.68,
  timeZone: 'Asia/Riyadh',
  method: 'UmmAlQura',
};
const ctx = { timeZone: 'Asia/Riyadh', location: riyadh };
const prefs = { enabled: true, quietStart: '23:00', quietEnd: '06:00', dailyCap: 6 };
const rule = (over: Partial<RuleLike>): RuleLike => ({
  id: 'r',
  category: 'custom',
  timing: { type: 'fixed', time: '21:30' },
  days: null,
  allowInQuietHours: false,
  enabled: true,
  ...over,
});

describe('fireTime', () => {
  it('fixed times are local wall-clock times', () => {
    const at = fireTime(rule({}), '2026-11-14', ctx)!;
    expect(wallClock(at, 'Asia/Riyadh')).toMatchObject({ hour: 21, minute: 30 });
  });

  it('prayer offsets follow that day’s prayer time', () => {
    const at = fireTime(
      rule({ timing: { type: 'prayer_offset', prayer: 'fajr', offsetMin: 20 } }),
      '2026-11-14',
      ctx,
    )!;
    expect(at.getTime() - computePrayerTimes('2026-11-14', riyadh).fajr.getTime()).toBe(
      20 * 60_000,
    );
  });

  it('respects weekday filters and skips prayer timings without a location', () => {
    expect(fireTime(rule({ days: [5] }), '2026-11-14', ctx)).toBeNull(); // Saturday ≠ Friday
    expect(fireTime(rule({ days: [5] }), '2026-11-13', ctx)).not.toBeNull();
    expect(
      fireTime(
        rule({ timing: { type: 'prayer_offset', prayer: 'isha', offsetMin: 0 } }),
        '2026-11-14',
        { timeZone: 'Asia/Riyadh' },
      ),
    ).toBeNull();
  });
});

describe('quiet hours', () => {
  it('handles windows that wrap past midnight (AC-NOT-quiet)', () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 14, h - 3, m)); // Riyadh = UTC+3
    expect(inQuietHours(at(23, 30), 'Asia/Riyadh', '23:00', '06:00')).toBe(true);
    expect(inQuietHours(at(5, 59), 'Asia/Riyadh', '23:00', '06:00')).toBe(true);
    expect(inQuietHours(at(6, 0), 'Asia/Riyadh', '23:00', '06:00')).toBe(false);
    expect(inQuietHours(at(14, 0), 'Asia/Riyadh', '13:00', '15:00')).toBe(true);
    expect(inQuietHours(at(14, 0), 'Asia/Riyadh', null, null)).toBe(false);
  });
});

describe('planReminders', () => {
  const from = new Date('2026-11-14T00:00:00Z');
  const to = new Date('2026-11-15T21:00:00Z'); // ~45h

  it('suppresses reminders in quiet hours unless the rule allows it', () => {
    const late = rule({ id: 'late', timing: { type: 'fixed', time: '23:30' } });
    const fajr = rule({
      id: 'fajr',
      timing: { type: 'prayer_offset', prayer: 'fajr', offsetMin: 0 },
      allowInQuietHours: true,
    });
    const plan = planReminders([late, fajr], from, to, ctx, prefs);
    expect(
      plan
        .filter((p) => p.ruleId === 'late')
        .every((p) => p.status === 'suppressed' && p.reason === 'quiet_hours'),
    ).toBe(true);
    expect(plan.filter((p) => p.ruleId === 'fajr').every((p) => p.status === 'pending')).toBe(true);
  });

  it('applies the daily cap per local date', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      rule({ id: `r${i}`, timing: { type: 'fixed', time: `1${i}:00` } }),
    );
    const plan = planReminders(many, from, to, ctx, { ...prefs, dailyCap: 3 });
    const day14 = plan.filter((p) => wallClock(p.fireAt, 'Asia/Riyadh').day === 14);
    expect(day14.filter((p) => p.status === 'pending')).toHaveLength(3);
    expect(day14.filter((p) => p.reason === 'daily_cap')).toHaveLength(2);
  });

  it('is deterministic (the basis of idempotent planning) and empty when disabled', () => {
    const rules = defaultRules(6).map((r, i) => ({ ...r, id: `d${i}`, enabled: true }));
    const a = planReminders(rules, from, to, ctx, prefs);
    const b = planReminders(rules, from, to, ctx, prefs);
    expect(a.map((p) => [p.ruleId, p.fireAt.toISOString(), p.status])).toEqual(
      b.map((p) => [p.ruleId, p.fireAt.toISOString(), p.status]),
    );
    expect(planReminders(rules, from, to, ctx, { ...prefs, enabled: false })).toEqual([]);
  });

  it('defaults: only the reflection and weekly review reminders start enabled', () => {
    const d = defaultRules(6);
    expect(d.filter((r) => r.enabled).map((r) => r.category)).toEqual([
      'reflection',
      'weekly_review',
    ]);
    expect(d.find((r) => r.category === 'weekly_review')!.days).toEqual([5]); // week starts Saturday → review Friday
  });
});
