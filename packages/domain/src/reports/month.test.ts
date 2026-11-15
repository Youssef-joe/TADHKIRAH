import { describe, expect, it } from 'vitest';
import { addDays, type LocalDate } from '../calendar/dates.js';
import { toHijri } from '../calendar/hijri.js';
import { monthDates, monthOf, parseMonthKey, shiftMonth } from './month.js';

describe('monthly report months', () => {
  it('lists Gregorian months, including leap Februaries', () => {
    const nov = monthDates('2026-11', 'gregorian');
    expect(nov).toHaveLength(30);
    expect(nov[0]).toBe('2026-11-01');
    expect(nov.at(-1)).toBe('2026-11-30');
    expect(monthDates('2028-02', 'gregorian')).toHaveLength(29);
    expect(monthDates('2027-02', 'gregorian')).toHaveLength(28);
  });

  it('resolves Hijri months to whole runs of 29 or 30 days', () => {
    // Ramadan 1447 (Umm al-Qura) began on 18 February 2026.
    const ramadan = monthDates('1447-09', 'hijri');
    expect(ramadan[0]).toBe('2026-02-18');
    expect([29, 30]).toContain(ramadan.length);
    for (const d of ramadan) expect(toHijri(d)).toMatchObject({ year: 1447, month: 9 });
    expect(toHijri(addDays(ramadan[0]!, -1)).month).toBe(8);
    expect(toHijri(addDays(ramadan.at(-1)!, 1)).month).toBe(10);
  });

  it('tiles consecutive Hijri months with no gaps or overlaps, across a year end', () => {
    let key = '1446-10';
    let prevEnd: LocalDate | null = null;
    for (let i = 0; i < 30; i++) {
      const days = monthDates(key, 'hijri');
      if (prevEnd) expect(days[0]).toBe(addDays(prevEnd, 1));
      prevEnd = days.at(-1)!;
      key = shiftMonth(key, 1);
    }
  });

  it('applies the user’s moon-sighting offset', () => {
    const plain = monthDates('1447-09', 'hijri');
    const later = monthDates('1447-09', 'hijri', -1);
    expect(later[0]).toBe(addDays(plain[0]!, 1));
  });

  it('finds the month containing a day, in either calendar', () => {
    expect(monthOf('2026-11-15', 'gregorian')).toBe('2026-11');
    const h = toHijri('2026-11-15');
    expect(parseMonthKey(monthOf('2026-11-15', 'hijri'))).toEqual({
      year: h.year,
      month: h.month,
    });
    expect(monthDates(monthOf('2026-11-15', 'hijri'), 'hijri')).toContain('2026-11-15');
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('1448-01', -1)).toBe('1447-12');
    expect(shiftMonth('2026-03', -15)).toBe('2024-12');
  });

  it('rejects malformed keys', () => {
    expect(() => parseMonthKey('2026-13')).toThrow();
    expect(() => parseMonthKey('26-01')).toThrow();
  });
});
