import { describe, expect, it } from 'vitest';
import {
  addDays,
  civilDate,
  isLocalDate,
  isValidTimeZone,
  weekday,
  zonedTimeToInstant,
} from './dates.js';
import { formatHijri, toHijri } from './hijri.js';

describe('local dates', () => {
  it('validates real calendar dates only', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-2-1')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('computes the weekday', () => {
    expect(weekday('2026-11-13')).toBe(5); // Friday
  });

  it('converts between instants and wall clock time', () => {
    expect(civilDate(new Date('2026-11-13T21:30:00Z'), 'Asia/Riyadh')).toBe('2026-11-14');
    expect(zonedTimeToInstant('2026-11-14', '04:00', 'Asia/Dubai').toISOString()).toBe(
      '2026-11-14T00:00:00.000Z',
    );
    // DST spring-forward gap in London (01:30 doesn't exist on 29 Mar 2026)
    expect(zonedTimeToInstant('2026-03-29', '01:30', 'Europe/London').toISOString()).toBe(
      '2026-03-29T01:30:00.000Z',
    );
  });

  it('validates time zones', () => {
    expect(isValidTimeZone('Asia/Riyadh')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('hijri', () => {
  it('returns an Umm al-Qura date in 1448 AH for November 2026', () => {
    expect(toHijri('2026-11-14').year).toBe(1448);
  });

  it('applies the user offset', () => {
    const base = toHijri('2026-11-14');
    const plus1 = toHijri('2026-11-14', 1);
    expect(plus1).not.toEqual(base);
    expect(() => toHijri('2026-11-14', 3)).toThrow(RangeError);
  });

  it('formats in Arabic with Arabic-Indic digits by default', () => {
    expect(formatHijri('2026-11-14', 'ar')).toMatch(/[٠-٩]/);
    expect(formatHijri('2026-11-14', 'en')).toMatch(/1448/);
  });
});
