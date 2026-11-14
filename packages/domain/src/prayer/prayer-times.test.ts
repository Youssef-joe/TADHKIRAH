import { describe, expect, it } from 'vitest';
import { wallClock } from '../calendar/dates.js';
import { computePrayerTimes, computeWindows, type PrayerLocation } from './prayer-times.js';
import { suggestedMethod } from './region-defaults.js';

const cities: Record<string, PrayerLocation> = {
  makkah: { latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh', method: 'UmmAlQura' },
  dubai: { latitude: 25.2048, longitude: 55.2708, timeZone: 'Asia/Dubai', method: 'Dubai' },
  cairo: { latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo', method: 'Egyptian' },
  amman: { latitude: 31.9454, longitude: 35.9284, timeZone: 'Asia/Amman', method: 'Egyptian' },
  oslo: {
    latitude: 59.9139,
    longitude: 10.7522,
    timeZone: 'Europe/Oslo',
    method: 'MuslimWorldLeague',
    highLatRule: 'seventh_of_night',
  },
};

const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

describe('computePrayerTimes', () => {
  // Basic sanity checks only. M2 will add checks against official published timetables.
  for (const [name, loc] of Object.entries(cities)) {
    for (const date of ['2026-06-21', '2026-11-14', '2026-12-21']) {
      it(`${name} ${date}: prayers are in order and Dhuhr is near local noon`, () => {
        const t = computePrayerTimes(date, loc);
        for (let i = 1; i < ORDER.length; i++) {
          expect(t[ORDER[i]!].getTime()).toBeGreaterThan(t[ORDER[i - 1]!].getTime());
        }
        const dhuhr = wallClock(t.dhuhr, loc.timeZone);
        expect(dhuhr.hour).toBeGreaterThanOrEqual(11);
        expect(dhuhr.hour).toBeLessThanOrEqual(13);
      });
    }
  }

  it('returns the same instants whatever timezone the server runs in', () => {
    // Vitest runs this file under the TZ from the environment; CI runs it under several TZ values.
    const t = computePrayerTimes('2026-11-14', cities.makkah!);
    expect(wallClock(t.fajr, 'Asia/Riyadh').hour).toBe(5);
  });

  it('applies the Hanafi Asr setting (later Asr)', () => {
    const std = computePrayerTimes('2026-11-14', cities.cairo!);
    const hanafi = computePrayerTimes('2026-11-14', { ...cities.cairo!, asrMethod: 'hanafi' });
    expect(hanafi.asr.getTime()).toBeGreaterThan(std.asr.getTime());
  });

  it('applies manual minute adjustments', () => {
    const base = computePrayerTimes('2026-11-14', cities.dubai!);
    const adj = computePrayerTimes('2026-11-14', { ...cities.dubai!, adjustments: { fajr: 2 } });
    expect(adj.fajr.getTime() - base.fajr.getTime()).toBe(120_000);
  });
});

describe('computeWindows', () => {
  it('last third of the night ends at the next Fajr and covers a third of Maghrib→Fajr', () => {
    const today = computePrayerTimes('2026-11-14', cities.makkah!);
    const next = computePrayerTimes('2026-11-15', cities.makkah!);
    const w = computeWindows('2026-11-14', cities.makkah!);
    expect(w.lastThirdOfNight.end).toEqual(next.fajr);
    const night = next.fajr.getTime() - today.maghrib.getTime();
    const third = w.lastThirdOfNight.end.getTime() - w.lastThirdOfNight.start.getTime();
    expect(Math.abs(third - night / 3)).toBeLessThan(1000);
  });

  it('only includes the Jumu`ah window on Fridays', () => {
    expect(computeWindows('2026-11-13', cities.dubai!).jumuah).toBeDefined(); // Friday
    expect(computeWindows('2026-11-14', cities.dubai!).jumuah).toBeUndefined(); // Saturday
  });

  it('uses the user’s khutbah time for the Jumu`ah window when set', () => {
    const w = computeWindows('2026-11-13', { ...cities.dubai!, jumuahKhutbahTime: '12:45' });
    const start = wallClock(w.jumuah!.start, 'Asia/Dubai');
    expect([start.hour, start.minute]).toEqual([12, 45]);
  });
});

describe('suggestedMethod', () => {
  it('suggests regional defaults', () => {
    expect(suggestedMethod('SA')).toBe('UmmAlQura');
    expect(suggestedMethod('ae')).toBe('Dubai');
    expect(suggestedMethod('FR')).toBe('MuslimWorldLeague');
    expect(suggestedMethod(undefined)).toBe('MuslimWorldLeague');
  });
});

describe('nextPrayer', () => {
  const loc = cities.makkah!;
  const today = computePrayerTimes('2026-11-14', loc);
  const tomorrow = computePrayerTimes('2026-11-15', loc);

  it('returns the upcoming prayer, including sunrise', async () => {
    const { nextPrayer } = await import('./prayer-times.js');
    expect(nextPrayer(today, tomorrow, new Date(today.fajr.getTime() + 60_000)).name).toBe(
      'sunrise',
    );
    expect(nextPrayer(today, tomorrow, new Date(today.asr.getTime() - 60_000)).name).toBe('asr');
  });

  it("rolls over to tomorrow's Fajr after Isha", async () => {
    const { nextPrayer } = await import('./prayer-times.js');
    const n = nextPrayer(today, tomorrow, new Date(today.isha.getTime() + 60_000));
    expect(n).toEqual({ name: 'fajr', at: tomorrow.fajr });
  });
});
