import { addDays, weekday, type LocalDate } from '../calendar/dates.js';
import type { Consistency } from '../worship/day-state.js';

/** The first day of the week containing `date`, given the user's week start (0 = Sunday … 6 = Saturday). */
export function weekStartFor(date: LocalDate, weekStart: number): LocalDate {
  const back = (weekday(date) - weekStart + 7) % 7;
  return addDays(date, -back);
}

export function weekDates(start: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * "Worth some attention" (REP-5): an activity logged on fewer than half of its
 * eligible days, once there are at least 3 eligible days. It's behavioural
 * only, an invitation rather than a judgement.
 */
export function needsAttention(c: Consistency): boolean {
  return c.eligible >= 3 && c.logged * 2 < c.eligible;
}
