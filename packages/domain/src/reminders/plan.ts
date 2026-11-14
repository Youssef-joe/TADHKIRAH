import {
  addDays,
  civilDate,
  weekday,
  wallClock,
  zonedTimeToInstant,
  type LocalDate,
} from '../calendar/dates.js';
import {
  computePrayerTimes,
  type PrayerLocation,
  type PrayerName,
} from '../prayer/prayer-times.js';

/**
 * Reminder planning (Module E), pure and deterministic: the same inputs always
 * give the same fire times, which (with a unique key) makes planning
 * idempotent. The server uses it today; mobile can run it on-device later.
 */
export const REMINDER_CATEGORIES = [
  'prayer',
  'adhkar_morning',
  'adhkar_evening',
  'quran',
  'reflection',
  'weekly_review',
  'custom',
] as const;
export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number];

export type ReminderTiming =
  | { type: 'fixed'; time: string } // HH:mm, local time
  | { type: 'prayer_offset'; prayer: PrayerName; offsetMin: number };

export interface RuleLike {
  id: string;
  category: ReminderCategory;
  timing: ReminderTiming;
  /** Weekdays (0 = Sunday … 6 = Saturday) of the local date; null = every day. */
  days: number[] | null;
  allowInQuietHours: boolean;
  enabled: boolean;
}

export interface PlanContext {
  timeZone: string;
  /** Needed for prayer-relative timings; without it those rules are skipped. */
  location?: PrayerLocation;
}

export interface PlanPrefs {
  enabled: boolean;
  quietStart: string | null; // HH:mm
  quietEnd: string | null; // HH:mm
  dailyCap: number;
}

export interface PlannedReminder {
  ruleId: string;
  fireAt: Date;
  status: 'pending' | 'suppressed';
  reason?: 'quiet_hours' | 'daily_cap';
}

/** When `rule` fires on local date `date`, or null if it doesn't fire that day. */
export function fireTime(rule: RuleLike, date: LocalDate, ctx: PlanContext): Date | null {
  if (rule.days && !rule.days.includes(weekday(date))) return null;
  if (rule.timing.type === 'fixed') return zonedTimeToInstant(date, rule.timing.time, ctx.timeZone);
  if (!ctx.location) return null;
  const times = computePrayerTimes(date, ctx.location);
  return new Date(times[rule.timing.prayer].getTime() + rule.timing.offsetMin * 60_000);
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/** Whether `instant` falls inside quiet hours (which may wrap past midnight, e.g. 23:00–06:00). */
export function inQuietHours(
  instant: Date,
  timeZone: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end || start === end) return false;
  const w = wallClock(instant, timeZone);
  const now = w.hour * 60 + w.minute;
  const s = minutesOf(start);
  const e = minutesOf(end);
  return s < e ? now >= s && now < e : now >= s || now < e;
}

/**
 * All reminders for enabled rules with fire times in [from, to). Quiet hours
 * suppress a reminder (they're dropped, not delayed) unless the rule allows
 * it. The daily cap limits pending reminders per local date. Suppressed items
 * are returned too, so they show up in history and debugging.
 */
export function planReminders(
  rules: readonly RuleLike[],
  from: Date,
  to: Date,
  ctx: PlanContext,
  prefs: PlanPrefs,
): PlannedReminder[] {
  if (!prefs.enabled) return [];
  const startDate = addDays(civilDate(from, ctx.timeZone), -1);
  const endDate = addDays(civilDate(to, ctx.timeZone), 1);
  const out: PlannedReminder[] = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const at = fireTime(rule, d, ctx);
      if (at && at >= from && at < to) out.push({ ruleId: rule.id, fireAt: at, status: 'pending' });
    }
  }
  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.ruleId.localeCompare(b.ruleId));

  const byRule = new Map(rules.map((r) => [r.id, r]));
  const perDay = new Map<string, number>();
  for (const p of out) {
    const rule = byRule.get(p.ruleId)!;
    if (
      !rule.allowInQuietHours &&
      inQuietHours(p.fireAt, ctx.timeZone, prefs.quietStart, prefs.quietEnd)
    ) {
      p.status = 'suppressed';
      p.reason = 'quiet_hours';
      continue;
    }
    const day = civilDate(p.fireAt, ctx.timeZone);
    const n = perDay.get(day) ?? 0;
    if (n >= prefs.dailyCap) {
      p.status = 'suppressed';
      p.reason = 'daily_cap';
      continue;
    }
    perDay.set(day, n + 1);
  }
  return out;
}

/** Default rules for a new user. Only the evening reflection reminder is on by default (PRD J1). */
export function defaultRules(weekStart: number): Omit<RuleLike, 'id'>[] {
  const prayers: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  return [
    ...prayers.map((prayer) => ({
      category: 'prayer' as const,
      timing: { type: 'prayer_offset' as const, prayer, offsetMin: 0 },
      days: null,
      allowInQuietHours: prayer === 'fajr',
      enabled: false,
    })),
    {
      category: 'adhkar_morning',
      timing: { type: 'prayer_offset', prayer: 'fajr', offsetMin: 20 },
      days: null,
      allowInQuietHours: false,
      enabled: false,
    },
    {
      category: 'adhkar_evening',
      timing: { type: 'prayer_offset', prayer: 'asr', offsetMin: 20 },
      days: null,
      allowInQuietHours: false,
      enabled: false,
    },
    {
      category: 'quran',
      timing: { type: 'prayer_offset', prayer: 'maghrib', offsetMin: 15 },
      days: null,
      allowInQuietHours: false,
      enabled: false,
    },
    {
      category: 'reflection',
      timing: { type: 'prayer_offset', prayer: 'isha', offsetMin: 30 },
      days: null,
      allowInQuietHours: false,
      enabled: true,
    },
    {
      category: 'weekly_review',
      timing: { type: 'fixed', time: '20:00' },
      days: [(weekStart + 6) % 7],
      allowInQuietHours: false,
      enabled: true,
    },
  ];
}
