import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../calendar/dates.js';
import { CATALOG, CATALOG_BY_KEY } from './catalog.js';
import {
  consistency,
  dayState,
  isScheduled,
  type DayFlagsLike,
  type LogLike,
} from './day-state.js';

const fajr = { ...CATALOG_BY_KEY.get('fajr')!, dailyTarget: null };
const adhkar = { ...CATALOG_BY_KEY.get('morning_adhkar')!, dailyTarget: null };
const quran = { ...CATALOG_BY_KEY.get('quran_pages')!, dailyTarget: 5 };
const fast = { ...CATALOG_BY_KEY.get('voluntary_fast')!, dailyTarget: null };
const TODAY = '2026-11-14' as LocalDate; // Saturday

describe('catalog', () => {
  it('keeps obligatory acts to the five prayers, and keys unique', () => {
    expect(new Set(CATALOG.map((a) => a.key)).size).toBe(CATALOG.length);
    expect(CATALOG.filter((a) => a.obligation === 'obligatory').map((a) => a.key)).toEqual([
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ]);
  });
});

describe('dayState', () => {
  it('never reports failure: unlogged scheduled days are "not_logged"', () => {
    expect(dayState(fajr, '2026-11-13', TODAY)).toBe('not_logged');
  });

  it('treats any prayer status (including qada) as logged, and "excused" as excused', () => {
    expect(dayState(fajr, TODAY, TODAY, { prayerStatus: 'later' })).toBe('logged');
    expect(dayState(fajr, TODAY, TODAY, { prayerStatus: 'qada' })).toBe('logged');
    expect(dayState(fajr, TODAY, TODAY, { prayerStatus: 'excused' })).toBe('excused');
  });

  it('excused days exempt prayer and fasting, but not adhkar', () => {
    const flags = { excused: true };
    expect(dayState(fajr, TODAY, TODAY, undefined, flags)).toBe('excused');
    expect(dayState(adhkar, TODAY, TODAY, undefined, flags)).toBe('not_logged');
  });

  it('marks counts below the daily goal as partial', () => {
    expect(dayState(quran, TODAY, TODAY, { amount: 2 })).toBe('partial');
    expect(dayState(quran, TODAY, TODAY, { amount: 5 })).toBe('logged');
  });

  it('respects weekday schedules and future dates', () => {
    expect(isScheduled(fast.schedule, '2026-11-16')).toBe(true); // Monday
    expect(dayState(fast, '2026-11-14', TODAY)).toBe('not_scheduled'); // Saturday
    expect(dayState(fajr, '2026-11-15', TODAY)).toBe('future');
  });
});

describe('consistency (AC-WOR-excused)', () => {
  it('Fajr shows "X of 6" when one day of the week is excused', () => {
    const logs = new Map<LocalDate, LogLike>([
      ['2026-11-08', { prayerStatus: 'on_time' }],
      ['2026-11-09', { prayerStatus: 'on_time' }],
      ['2026-11-11', { prayerStatus: 'later' }],
      ['2026-11-12', { prayerStatus: 'on_time' }],
      ['2026-11-14', { prayerStatus: 'qada' }],
    ]);
    const flags = new Map<LocalDate, DayFlagsLike>([['2026-11-10', { excused: true }]]);
    expect(consistency(fajr, '2026-11-08', '2026-11-14', TODAY, logs, flags)).toEqual({
      eligible: 6,
      logged: 5,
      excused: 1,
    });
  });

  it('counts only scheduled days for weekday activities', () => {
    const logs = new Map<LocalDate, LogLike>([['2026-11-09', { done: true }]]); // Monday
    expect(consistency(fast, '2026-11-08', '2026-11-14', TODAY, logs, new Map())).toEqual({
      eligible: 2, // Monday + Thursday
      logged: 1,
      excused: 0,
    });
  });

  it('never counts future days', () => {
    expect(
      consistency(fajr, '2026-11-14', '2026-11-20', TODAY, new Map(), new Map()).eligible,
    ).toBe(1);
  });
});
