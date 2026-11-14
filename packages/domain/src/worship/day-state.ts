import { addDays, weekday, type LocalDate } from '../calendar/dates.js';
import { EXCUSABLE_CATEGORIES, type Category, type Measure, type Schedule } from './catalog.js';

export type PrayerStatus = 'on_time' | 'later' | 'qada' | 'excused';

export interface ActivityLike {
  category: Category;
  measure: Measure;
  schedule: Schedule;
  dailyTarget?: number | null;
}

export interface LogLike {
  prayerStatus?: PrayerStatus | null;
  done?: boolean | null;
  amount?: number | null;
}

export interface DayFlagsLike {
  excused?: boolean;
  travelling?: boolean;
}

/**
 * How a day looks for one activity. There's deliberately no "missed" or
 * "failed" state: unlogged days are simply "not logged".
 */
export type DayState = 'logged' | 'partial' | 'not_logged' | 'excused' | 'not_scheduled' | 'future';

/** Whether the activity is expected on this date (times-per-week activities can happen any day). */
export function isScheduled(schedule: Schedule, date: LocalDate): boolean {
  switch (schedule.type) {
    case 'daily':
    case 'times_per_week':
      return true;
    case 'weekdays':
      return schedule.days.includes(weekday(date));
  }
}

export function hasValue(log: LogLike | undefined): boolean {
  if (!log) return false;
  return log.prayerStatus != null || log.done === true || (log.amount ?? 0) > 0;
}

export function dayState(
  activity: ActivityLike,
  date: LocalDate,
  today: LocalDate,
  log?: LogLike,
  flags?: DayFlagsLike,
): DayState {
  if (date > today) return 'future';
  if (log?.prayerStatus === 'excused') return 'excused';
  if (flags?.excused && EXCUSABLE_CATEGORIES.has(activity.category) && !hasValue(log))
    return 'excused';
  if (hasValue(log)) {
    if (
      activity.measure === 'count' &&
      activity.dailyTarget &&
      (log?.amount ?? 0) < activity.dailyTarget
    ) {
      return 'partial';
    }
    return 'logged';
  }
  return isScheduled(activity.schedule, date) ? 'not_logged' : 'not_scheduled';
}

export interface Consistency {
  /** Days the activity was expected and not excused. */
  eligible: number;
  /** Eligible days with something logged (partial counts as logged). */
  logged: number;
  excused: number;
}

/**
 * Behavioural summary for a date range: counts only, never a score or percentage
 * of faith (PRD REP-8). Excused days leave the denominator for excusable categories.
 * Times-per-week activities: eligible = n per week, capped by the range.
 */
export function consistency(
  activity: ActivityLike,
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  logs: ReadonlyMap<LocalDate, LogLike>,
  flags: ReadonlyMap<LocalDate, DayFlagsLike>,
): Consistency {
  let eligible = 0;
  let logged = 0;
  let excused = 0;
  let days = 0;
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    days++;
    const state = dayState(activity, d, today, logs.get(d), flags.get(d));
    if (state === 'excused') excused++;
    else if (state === 'logged' || state === 'partial') {
      logged++;
      eligible++;
    } else if (state === 'not_logged') eligible++;
  }
  if (activity.schedule.type === 'times_per_week') {
    const expected = Math.ceil((activity.schedule.n * Math.max(0, days - excused)) / 7);
    return { eligible: Math.max(expected, logged), logged, excused };
  }
  return { eligible, logged, excused };
}
