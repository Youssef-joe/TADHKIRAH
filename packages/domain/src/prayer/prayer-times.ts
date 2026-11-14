import {
  CalculationMethod,
  type CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from 'adhan';
import {
  addDays,
  parseLocalDate,
  weekday,
  zonedTimeToInstant,
  type LocalDate,
} from '../calendar/dates.js';

export const CALCULATION_METHODS = [
  'MuslimWorldLeague',
  'Egyptian',
  'Karachi',
  'UmmAlQura',
  'Dubai',
  'Qatar',
  'Kuwait',
  'MoonsightingCommittee',
  'NorthAmerica',
  'Singapore',
  'Turkey',
  'Tehran',
] as const;
export type CalculationMethodKey = (typeof CALCULATION_METHODS)[number];

export type AsrMethod = 'standard' | 'hanafi';
export type HighLatRule = 'middle_of_night' | 'seventh_of_night' | 'twilight_angle';
export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerLocation {
  latitude: number;
  longitude: number;
  timeZone: string;
  method: CalculationMethodKey;
  asrMethod?: AsrMethod;
  highLatRule?: HighLatRule;
  /** Manual per-prayer adjustments in minutes. */
  adjustments?: Partial<Record<PrayerName, number>>;
  /** The user's mosque khutbah start time (`HH:mm`), used for the Jumu'ah window. */
  jumuahKhutbahTime?: string;
}

export type DailyPrayerTimes = Record<PrayerName, Date>;

export interface TimeWindow {
  start: Date;
  end: Date;
}

const HIGH_LAT: Record<HighLatRule, CalculationParameters['highLatitudeRule']> = {
  middle_of_night: HighLatitudeRule.MiddleOfTheNight,
  seventh_of_night: HighLatitudeRule.SeventhOfTheNight,
  twilight_angle: HighLatitudeRule.TwilightAngle,
};

function parameters(loc: PrayerLocation): CalculationParameters {
  const factory = CalculationMethod[loc.method];
  if (typeof factory !== 'function')
    throw new RangeError(`Unknown calculation method: ${loc.method}`);
  const params = factory();
  params.madhab = loc.asrMethod === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (loc.highLatRule) params.highLatitudeRule = HIGH_LAT[loc.highLatRule];
  if (loc.adjustments) Object.assign(params.adjustments, loc.adjustments);
  return params;
}

/**
 * Prayer times for the civil date `date` at `loc`.
 *
 * adhan reads the year/month/day of the Date it receives using the system's local
 * timezone, so we build that Date from local components. The instants it returns
 * are absolute, so this works whatever timezone the server runs in.
 */
export function computePrayerTimes(date: LocalDate, loc: PrayerLocation): DailyPrayerTimes {
  const { year, month, day } = parseLocalDate(date);
  const pt = new PrayerTimes(
    new Coordinates(loc.latitude, loc.longitude),
    new Date(year, month - 1, day),
    parameters(loc),
  );
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

export interface TrackingDayWindows {
  /** Last third of the night that follows this tracking day: Maghrib(D) → Fajr(D+1). */
  lastThirdOfNight: TimeWindow;
  /** Asr(D) → Maghrib(D). */
  afterAsrUntilMaghrib: TimeWindow;
  /** Fridays only: khutbah start (or Dhuhr) → +60 min by default. */
  jumuah?: TimeWindow;
}

const JUMUAH_DEFAULT_MINUTES = 60;

/**
 * Time windows tied to the tracking day `date` (see ADR-001). These are general
 * periods computed from prayer times, not exact moments. Which narrations apply
 * to which window is documented in the content records, not here.
 */
export function computeWindows(
  date: LocalDate,
  loc: PrayerLocation,
  today: DailyPrayerTimes = computePrayerTimes(date, loc),
): TrackingDayWindows {
  const next = computePrayerTimes(addDays(date, 1), loc);
  const nightMs = next.fajr.getTime() - today.maghrib.getTime();
  const windows: TrackingDayWindows = {
    lastThirdOfNight: {
      start: new Date(today.maghrib.getTime() + Math.round((nightMs * 2) / 3)),
      end: next.fajr,
    },
    afterAsrUntilMaghrib: { start: today.asr, end: today.maghrib },
  };
  if (weekday(date) === 5) {
    const start = loc.jumuahKhutbahTime
      ? zonedTimeToInstant(date, loc.jumuahKhutbahTime, loc.timeZone)
      : today.dhuhr;
    windows.jumuah = { start, end: new Date(start.getTime() + JUMUAH_DEFAULT_MINUTES * 60_000) };
  }
  return windows;
}
