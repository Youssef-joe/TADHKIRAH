import { describe, expect, it } from 'vitest';
import { computePrayerTimes, computeWindows, type PrayerLocation } from '../prayer/prayer-times.js';
import { occasionTiming } from './windows.js';

const riyadh: PrayerLocation = {
  latitude: 24.71,
  longitude: 46.68,
  method: 'UmmAlQura',
  timeZone: 'Asia/Riyadh',
};
const FRIDAY = '2026-11-20';
const SATURDAY = '2026-11-21';

describe('occasion timing', () => {
  it('the last third of the night is the computed period Maghrib → next Fajr', () => {
    const t = occasionTiming('last_third_of_night', SATURDAY, riyadh);
    expect(t).toEqual({ kind: 'period', ...computeWindows(SATURDAY, riyadh).lastThirdOfNight });
  });

  it('Friday windows exist only on Fridays', () => {
    expect(occasionTiming('friday_last_hour_after_asr', SATURDAY, riyadh)).toEqual({
      kind: 'fridays_only',
    });
    expect(occasionTiming('jumuah_imam_to_prayer', SATURDAY, riyadh)).toEqual({
      kind: 'fridays_only',
    });
  });

  it('the last hour after Asr on Friday ends at Maghrib', () => {
    const t = occasionTiming('friday_last_hour_after_asr', FRIDAY, riyadh);
    const { maghrib } = computePrayerTimes(FRIDAY, riyadh);
    expect(t).toEqual({
      kind: 'period',
      start: new Date(maghrib.getTime() - 3_600_000),
      end: maghrib,
    });
  });

  it('the Jumuah window starts at the mosque khutbah time if known, and is never given an invented end', () => {
    expect(occasionTiming('jumuah_imam_to_prayer', FRIDAY, riyadh)).toEqual({ kind: 'described' });
    const t = occasionTiming('jumuah_imam_to_prayer', FRIDAY, {
      ...riyadh,
      jumuahKhutbahTime: '11:45',
    });
    expect(t.kind).toBe('from');
    expect(t.kind === 'from' && t.start.toISOString()).toBe('2026-11-20T08:45:00.000Z');
  });

  it('between adhan and iqamah lists the five adhans; sujud is guidance only', () => {
    const t = occasionTiming('between_adhan_iqamah', SATURDAY, riyadh);
    expect(t.kind === 'after_adhans' && t.adhans.map((a) => a.prayer)).toEqual([
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha',
    ]);
    expect(occasionTiming('in_sujud', SATURDAY, riyadh)).toEqual({ kind: 'guidance' });
  });
});
