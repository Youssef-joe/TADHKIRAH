import { describe, expect, it } from 'vitest';
import type { LocalDate } from '../calendar/dates.js';
import { mergeRanges, normalizeMemorization, revisionDue, searchSurahs } from './progress.js';
import {
  ayahsBetween,
  isOrdered,
  isValidRef,
  JUZ_STARTS,
  juzOf,
  SURAHS,
  TOTAL_AYAHS,
} from './surahs.js';

describe('surah metadata', () => {
  it('has 114 surahs totalling 6,236 ayahs', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.ayahs, 0)).toBe(TOTAL_AYAHS);
  });

  it('spot-checks well-known counts', () => {
    expect(SURAHS[0]!.ayahs).toBe(7);
    expect(SURAHS[1]!.ayahs).toBe(286);
    expect(SURAHS[17]!.en).toBe('Al-Kahf');
    expect(SURAHS[17]!.ayahs).toBe(110);
    expect(SURAHS[66]!.ayahs).toBe(30); // Al-Mulk
    expect(SURAHS[113]!.ayahs).toBe(6);
  });

  it('juz starts are valid references in order', () => {
    expect(JUZ_STARTS).toHaveLength(30);
    for (let i = 0; i < JUZ_STARTS.length; i++) {
      const [s, a] = JUZ_STARTS[i]!;
      expect(isValidRef({ surah: s, ayah: a })).toBe(true);
      if (i > 0) {
        const [ps, pa] = JUZ_STARTS[i - 1]!;
        expect(isOrdered({ surah: ps, ayah: pa }, { surah: s, ayah: a })).toBe(true);
      }
    }
  });

  it('finds the juz of a verse', () => {
    expect(juzOf(1, 1)).toBe(1);
    expect(juzOf(2, 141)).toBe(1);
    expect(juzOf(2, 142)).toBe(2);
    expect(juzOf(67)).toBe(29);
    expect(juzOf(114)).toBe(30);
  });

  it('counts ayahs across surahs', () => {
    expect(ayahsBetween({ surah: 1, ayah: 1 }, { surah: 1, ayah: 7 })).toBe(7);
    expect(ayahsBetween({ surah: 113, ayah: 1 }, { surah: 114, ayah: 6 })).toBe(11);
    expect(ayahsBetween({ surah: 1, ayah: 1 }, { surah: 114, ayah: 6 })).toBe(TOTAL_AYAHS);
    expect(ayahsBetween({ surah: 2, ayah: 5 }, { surah: 2, ayah: 1 })).toBe(0);
  });
});

describe('memorization', () => {
  it('merges overlapping and adjacent ranges and clamps to the surah', () => {
    expect(
      mergeRanges(
        [
          [10, 20],
          [1, 5],
          [6, 8],
          [18, 40],
        ],
        30,
      ),
    ).toEqual([
      [1, 8],
      [10, 30],
    ]);
  });

  it('infers status from ranges', () => {
    expect(normalizeMemorization(67, 'in_progress', [[1, 30]])).toEqual({
      status: 'memorized',
      ranges: [[1, 30]],
    });
    expect(normalizeMemorization(67, 'not_started', [[1, 10]])).toEqual({
      status: 'in_progress',
      ranges: [[1, 10]],
    });
    expect(normalizeMemorization(67, 'memorized', [])).toEqual({
      status: 'memorized',
      ranges: [[1, 30]],
    });
    expect(normalizeMemorization(67, 'not_started', [])).toEqual({
      status: 'not_started',
      ranges: [],
    });
  });

  it('suggests revision for the longest-unrevised memorized surahs, never-revised first', () => {
    const today = '2026-11-14' as LocalDate;
    const due = revisionDue(
      [
        { surah: 114, lastRevisedOn: '2026-11-13' as LocalDate }, // recent → not due
        { surah: 67, lastRevisedOn: '2026-10-01' as LocalDate },
        { surah: 78, lastRevisedOn: null },
        { surah: 36, lastRevisedOn: '2026-11-01' as LocalDate },
      ],
      today,
    );
    expect(due.map((d) => d.surah)).toEqual([78, 67, 36]);
  });
});

describe('searchSurahs', () => {
  it('finds by number, Arabic (with or without "al"/diacritics) and English', () => {
    expect(searchSurahs('67')[0]!.en).toBe('Al-Mulk');
    expect(searchSurahs('ملك')[0]!.n).toBe(67);
    expect(searchSurahs('الكهف')[0]!.n).toBe(18);
    expect(searchSurahs('kahf')[0]!.n).toBe(18);
    expect(searchSurahs('yasin').length + searchSurahs('ya-sin').length).toBeGreaterThan(0);
  });
});
