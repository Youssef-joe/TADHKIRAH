import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../calendar/dates.js';
import { needsAttention, weekDates, weekStartFor } from './week.js';

describe('weeks', () => {
  it('finds the week start for Saturday- and Monday-start weeks', () => {
    const sat = '2026-11-14' as LocalDate; // a Saturday
    expect(weekStartFor(sat, 6)).toBe('2026-11-14');
    expect(weekStartFor('2026-11-20' as LocalDate, 6)).toBe('2026-11-14'); // Friday
    expect(weekStartFor(sat, 1)).toBe('2026-11-09'); // Monday
    expect(weekStartFor(sat, 0)).toBe('2026-11-08'); // Sunday
  });

  it('lists seven consecutive days across month ends', () => {
    expect(weekDates('2026-11-28' as LocalDate)).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
    ]);
  });

  it('flags activities logged on fewer than half of at least 3 eligible days', () => {
    expect(needsAttention({ eligible: 7, logged: 3, excused: 0 })).toBe(true);
    expect(needsAttention({ eligible: 6, logged: 3, excused: 1 })).toBe(false);
    expect(needsAttention({ eligible: 2, logged: 0, excused: 0 })).toBe(false);
  });
});
