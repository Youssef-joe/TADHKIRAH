import { addDays, formatLocalDate, parseLocalDate, type LocalDate } from '../calendar/dates.js';
import { toHijri } from '../calendar/hijri.js';

/**
 * Monthly reports (REP-7) can follow the Gregorian or the Hijri (Umm al-Qura)
 * calendar: a Ramadan report matters more to most users than "March".
 * A month is written `YYYY-MM` in its own calendar (e.g. `1448-09` is Ramadan 1448).
 */
export type ReportCalendar = 'gregorian' | 'hijri';
export type MonthKey = string;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const m = MONTH_KEY.exec(key);
  if (!m) throw new RangeError(`Invalid month key: ${key}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function formatMonthKey(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** The month `n` months after `key` (negative goes back). */
export function shiftMonth(key: MonthKey, n: number): MonthKey {
  const { year, month } = parseMonthKey(key);
  const index = year * 12 + (month - 1) + n;
  return formatMonthKey(Math.floor(index / 12), (index % 12) + 1);
}

/** The month containing a tracking day. */
export function monthOf(date: LocalDate, calendar: ReportCalendar, hijriOffset = 0): MonthKey {
  if (calendar === 'gregorian') {
    const { year, month } = parseLocalDate(date);
    return formatMonthKey(year, month);
  }
  const h = toHijri(date, hijriOffset);
  return formatMonthKey(h.year, h.month);
}

function gregorianMonthDates(year: number, month: number): LocalDate[] {
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length }, (_, i) => formatLocalDate(year, month, i + 1));
}

/** Mean synodic month, used only to guess where to start looking. */
const SYNODIC = 29.530589;
// 1 Muharram 1 AH ≈ 19 July 622 (proleptic Gregorian, which is what Date uses).
const EPOCH_MS = Date.UTC(622, 6, 19);

function hijriMonthDates(year: number, month: number, offset: number): LocalDate[] {
  const inMonth = (d: LocalDate) => {
    const h = toHijri(d, offset);
    return h.year === year && h.month === month;
  };
  const guess = new Date(EPOCH_MS + Math.round(((year - 1) * 12 + month - 1) * SYNODIC) * 864e5);
  let d = formatLocalDate(guess.getUTCFullYear(), guess.getUTCMonth() + 1, guess.getUTCDate());
  // Converge on the 1st of the month, then settle the last day or two exactly.
  for (let i = 0; i < 8; i++) {
    const h = toHijri(d, offset);
    const delta = Math.round(((year - h.year) * 12 + (month - h.month)) * SYNODIC + (1 - h.day));
    if (delta === 0) break;
    d = addDays(d, delta);
  }
  for (let i = 0; i < 31 && inMonth(addDays(d, -1)); i++) d = addDays(d, -1);
  for (let i = 0; i < 31 && !inMonth(d); i++) d = addDays(d, 1);
  const out: LocalDate[] = [];
  for (let x = d; inMonth(x) && out.length < 31; x = addDays(x, 1)) out.push(x);
  if (out.length < 29) throw new RangeError(`Could not resolve Hijri month ${year}-${month}`);
  return out;
}

/** Every tracking day of a month, in order. */
export function monthDates(key: MonthKey, calendar: ReportCalendar, hijriOffset = 0): LocalDate[] {
  const { year, month } = parseMonthKey(key);
  return calendar === 'gregorian'
    ? gregorianMonthDates(year, month)
    : hijriMonthDates(year, month, hijriOffset);
}
