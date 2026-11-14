import { computePrayerTimes, type PrayerLocation } from '../prayer/prayer-times.js';
import { addDays, civilDate, wallClock, type LocalDate } from './dates.js';

/** Fallback boundary used while the user has no location set (ADR-001). */
export const FALLBACK_DAY_START_HOUR = 4;

export type TrackingContext =
  ({ kind: 'located' } & PrayerLocation) | { kind: 'unlocated'; timeZone: string };

/**
 * The tracking day an instant belongs to. Each tracking day starts at local Fajr
 * and runs until the next Fajr (ADR-001).
 *
 *   D = civil date of `instant` in the user's timezone
 *   instant < Fajr(D) → D − 1, otherwise D
 *
 * This is the only function that decides which day a log or reflection belongs to.
 * The server and every client must use it.
 */
export function trackingDate(instant: Date, ctx: TrackingContext): LocalDate {
  const d = civilDate(instant, ctx.timeZone);
  if (ctx.kind === 'unlocated') {
    return wallClock(instant, ctx.timeZone).hour < FALLBACK_DAY_START_HOUR ? addDays(d, -1) : d;
  }
  const { fajr } = computePrayerTimes(d, ctx);
  return instant.getTime() < fajr.getTime() ? addDays(d, -1) : d;
}

/** When the tracking day `date` starts and ends. */
export function trackingDayBounds(
  date: LocalDate,
  ctx: PrayerLocation,
): { start: Date; end: Date } {
  return {
    start: computePrayerTimes(date, ctx).fajr,
    end: computePrayerTimes(addDays(date, 1), ctx).fajr,
  };
}
