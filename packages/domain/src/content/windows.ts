import { weekday, zonedTimeToInstant, type LocalDate } from '../calendar/dates.js';
import {
  computePrayerTimes,
  computeWindows,
  type PrayerLocation,
  type PrayerName,
} from '../prayer/prayer-times.js';

/**
 * Supplication occasions mapped onto a tracking day (CON-13, policy §7.3–7.4).
 * A narration that describes a *period* is shown as that period, computed from
 * prayer times. Nothing here invents an exact minute: where the end depends on
 * the local mosque, the end is described, not calculated.
 */
export const OCCASION_WINDOWS = [
  'last_third_of_night',
  'jumuah_imam_to_prayer',
  'friday_last_hour_after_asr',
  'between_adhan_iqamah',
  'in_sujud',
  'anytime',
] as const;
export type OccasionWindow = (typeof OCCASION_WINDOWS)[number];

export type OccasionTiming =
  /** A computed period, e.g. the last third of the night. */
  | { kind: 'period'; start: Date; end: Date }
  /** Starts at a known time; ends with an act (e.g. "until the prayer ends"). */
  | { kind: 'from'; start: Date }
  /** After each adhan, until the iqamah of the local mosque. */
  | { kind: 'after_adhans'; adhans: { prayer: PrayerName; at: Date }[] }
  /** Today, but the start depends on something we don't know (e.g. the khutbah time). */
  | { kind: 'described' }
  /** Only on Fridays. */
  | { kind: 'fridays_only' }
  /** Not tied to a time (e.g. during sujud). */
  | { kind: 'guidance' };

const ADHANS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export function occasionTiming(
  window: string,
  date: LocalDate,
  loc: PrayerLocation,
): OccasionTiming {
  const friday = weekday(date) === 5;
  switch (window as OccasionWindow) {
    case 'last_third_of_night':
      return { kind: 'period', ...computeWindows(date, loc).lastThirdOfNight };
    case 'friday_last_hour_after_asr': {
      if (!friday) return { kind: 'fridays_only' };
      const { maghrib } = computePrayerTimes(date, loc);
      return { kind: 'period', start: new Date(maghrib.getTime() - 60 * 60_000), end: maghrib };
    }
    case 'jumuah_imam_to_prayer':
      if (!friday) return { kind: 'fridays_only' };
      return loc.jumuahKhutbahTime
        ? { kind: 'from', start: zonedTimeToInstant(date, loc.jumuahKhutbahTime, loc.timeZone) }
        : { kind: 'described' };
    case 'between_adhan_iqamah': {
      const t = computePrayerTimes(date, loc);
      return { kind: 'after_adhans', adhans: ADHANS.map((prayer) => ({ prayer, at: t[prayer] })) };
    }
    default:
      return { kind: 'guidance' };
  }
}
