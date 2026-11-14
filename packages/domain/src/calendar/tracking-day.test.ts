import { describe, expect, it } from 'vitest';
import { computePrayerTimes, type PrayerLocation } from '../prayer/prayer-times.js';
import { trackingDate, trackingDayBounds } from './tracking-day.js';
import { wallClock } from './dates.js';

const riyadh: PrayerLocation = {
  latitude: 24.7136,
  longitude: 46.6753,
  timeZone: 'Asia/Riyadh',
  method: 'UmmAlQura',
};
const london: PrayerLocation = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeZone: 'Europe/London',
  method: 'MoonsightingCommittee',
  highLatRule: 'seventh_of_night',
};
const ctx = (loc: PrayerLocation) => ({ kind: 'located' as const, ...loc });

describe('trackingDate (ADR-001: the day starts at Fajr)', () => {
  const fajr = computePrayerTimes('2026-11-14', riyadh).fajr;

  it('belongs to the previous day one millisecond before Fajr', () => {
    expect(trackingDate(new Date(fajr.getTime() - 1), ctx(riyadh))).toBe('2026-11-13');
  });

  it('starts the new day exactly at Fajr', () => {
    expect(trackingDate(fajr, ctx(riyadh))).toBe('2026-11-14');
  });

  it('counts an after-midnight Isha/Witr toward the previous day', () => {
    // 00:30 local time in Riyadh on 14 Nov (UTC+3)
    expect(trackingDate(new Date('2026-11-13T21:30:00Z'), ctx(riyadh))).toBe('2026-11-13');
  });

  it('keeps late evening on the same day', () => {
    // 23:00 local time in Riyadh on 14 Nov
    expect(trackingDate(new Date('2026-11-14T20:00:00Z'), ctx(riyadh))).toBe('2026-11-14');
  });

  it('handles DST transitions (London, clocks go back 25 Oct 2026)', () => {
    const f = computePrayerTimes('2026-10-25', london).fajr;
    expect(trackingDate(new Date(f.getTime() - 60_000), ctx(london))).toBe('2026-10-24');
    expect(trackingDate(new Date(f.getTime() + 60_000), ctx(london))).toBe('2026-10-25');
  });

  it('falls back to 04:00 local time when no location is set', () => {
    const unlocated = { kind: 'unlocated' as const, timeZone: 'Asia/Dubai' };
    expect(trackingDate(new Date('2026-11-13T23:59:00Z'), unlocated)).toBe('2026-11-13'); // 03:59
    expect(trackingDate(new Date('2026-11-14T00:00:00Z'), unlocated)).toBe('2026-11-14'); // 04:00
  });

  it('bounds run from Fajr to the next Fajr', () => {
    const { start, end } = trackingDayBounds('2026-11-14', riyadh);
    expect(start).toEqual(fajr);
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
    expect(wallClock(start, 'Asia/Riyadh').hour).toBe(4);
  });
});
