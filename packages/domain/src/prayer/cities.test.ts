import { describe, expect, it } from 'vitest';
import { isValidTimeZone } from '../calendar/dates.js';
import {
  CITIES,
  nearestCity,
  normalizeForSearch,
  roundCoordinate,
  searchCities,
} from './cities.js';

describe('cities', () => {
  it('has unique ids, valid coordinates and valid time zones', () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    for (const c of CITIES) {
      expect(Math.abs(c.latitude), c.id).toBeLessThanOrEqual(90);
      expect(Math.abs(c.longitude), c.id).toBeLessThanOrEqual(180);
      expect(isValidTimeZone(c.timeZone), c.timeZone).toBe(true);
      expect(c.countryCode).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('normalizes Arabic spelling variants and diacritics', () => {
    expect(normalizeForSearch('مَكَّةُ')).toBe(normalizeForSearch('مكه'));
    expect(normalizeForSearch('إربد')).toBe('اربد');
  });

  it('finds cities in Arabic and English, prefix matches first', () => {
    expect(searchCities('مكه')[0]?.id).toBe('makkah');
    expect(searchCities('الرياض')[0]?.id).toBe('riyadh');
    expect(searchCities('dub')[0]?.id).toBe('dubai');
    expect(searchCities('abu')[0]?.id).toBe('abu-dhabi');
    expect(searchCities('')).toEqual([]);
  });

  it('labels a device location with the nearest city', () => {
    expect(nearestCity(24.7, 46.7).city.id).toBe('riyadh');
    expect(nearestCity(30.06, 31.25).city.id).toBe('cairo');
  });

  it('rounds coordinates to about 1 km', () => {
    expect(roundCoordinate(24.713612)).toBe(24.71);
    expect(roundCoordinate(-0.12775)).toBe(-0.13);
  });
});
