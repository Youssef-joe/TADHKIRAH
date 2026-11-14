/**
 * Timezone-safe date helpers with no dependencies.
 *
 * A `LocalDate` is a calendar date written `YYYY-MM-DD`, with no time or zone.
 * Every conversion between instants and local dates goes through these functions.
 */

export type LocalDate = string & { readonly __brand?: 'LocalDate' };

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: string): value is LocalDate {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number) as [number, number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  if (!isLocalDate(value)) throw new RangeError(`Invalid local date: ${value}`);
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 0 = Sunday … 6 = Saturday (same as `Date#getDay`). */
export function weekday(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading in `timeZone` at `instant`. */
export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** The civil date in `timeZone` at `instant`. */
export function civilDate(instant: Date, timeZone: string): LocalDate {
  const w = wallClock(instant, timeZone);
  return formatLocalDate(w.year, w.month, w.day);
}

/** UTC offset of `timeZone` at `instant`, in milliseconds (e.g. +3h for Asia/Riyadh). */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` reads `date` + `time` (`HH:mm`).
 * Times that fall in a DST gap move forward, as most platforms do.
 */
export function zonedTimeToInstant(date: LocalDate, time: string, timeZone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = tzOffsetMs(new Date(guess), timeZone);
  let t = guess - offset1;
  const offset2 = tzOffsetMs(new Date(t), timeZone);
  if (offset2 !== offset1) t = guess - offset2;
  return new Date(t);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
