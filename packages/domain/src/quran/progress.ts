import { addDays, type LocalDate } from '../calendar/dates.js';
import { normalizeForSearch } from '../prayer/cities.js';
import { SURAHS, surah, type Surah } from './surahs.js';

/** An inclusive ayah range within one surah: [from, to]. */
export type AyahRange = [number, number];

export type MemorizationStatus = 'not_started' | 'in_progress' | 'memorized';

/** Sorts, clamps to the surah, and merges overlapping or adjacent ranges. */
export function mergeRanges(ranges: readonly AyahRange[], ayahCount: number): AyahRange[] {
  const clean = ranges
    .map(
      ([a, b]) => [Math.max(1, Math.min(a, b)), Math.min(ayahCount, Math.max(a, b))] as AyahRange,
    )
    .filter(([a, b]) => a <= b)
    .sort((x, y) => x[0] - y[0]);
  const out: AyahRange[] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function countAyahs(ranges: readonly AyahRange[]): number {
  return ranges.reduce((n, [a, b]) => n + (b - a + 1), 0);
}

/**
 * Normalizes a memorization entry: ranges are merged, "memorized" means the
 * whole surah, and a status is inferred from the ranges when they say more.
 */
export function normalizeMemorization(
  surahN: number,
  status: MemorizationStatus,
  ranges: readonly AyahRange[],
): { status: MemorizationStatus; ranges: AyahRange[] } {
  const total = surah(surahN).ayahs;
  if (status === 'memorized') return { status, ranges: [[1, total]] };
  const merged = mergeRanges(ranges, total);
  const count = countAyahs(merged);
  if (count === total) return { status: 'memorized', ranges: [[1, total]] };
  if (status === 'not_started' && count === 0) return { status, ranges: [] };
  return {
    status: count > 0 || status === 'in_progress' ? 'in_progress' : 'not_started',
    ranges: merged,
  };
}

export interface RevisionCandidate {
  surah: number;
  lastRevisedOn: LocalDate | null;
}

/**
 * Memorized surahs ordered by how long since they were last revised (never
 * revised first). A surah is due when its last revision is at least
 * `afterDays` ago. It's a gentle suggestion, never an overdue alarm.
 */
export function revisionDue(
  items: readonly RevisionCandidate[],
  today: LocalDate,
  afterDays = 7,
  limit = 5,
): RevisionCandidate[] {
  const cutoff = addDays(today, -afterDays);
  return items
    .filter((i) => i.lastRevisedOn === null || i.lastRevisedOn <= cutoff)
    .sort((a, b) => {
      if (a.lastRevisedOn === b.lastRevisedOn) return a.surah - b.surah;
      if (a.lastRevisedOn === null) return -1;
      if (b.lastRevisedOn === null) return 1;
      return a.lastRevisedOn < b.lastRevisedOn ? -1 : 1;
    })
    .slice(0, limit);
}

/** Finds surahs by number, Arabic name (spelling-tolerant) or English name. */
export function searchSurahs(query: string): Surah[] {
  const q = query.trim();
  if (!q) return [...SURAHS];
  if (/^\d+$/.test(q)) {
    const n = Number(q);
    return SURAHS.filter((s) => s.n === n || String(s.n).startsWith(q));
  }
  const nq = normalizeForSearch(q).replace(/^ال/, '');
  return SURAHS.filter((s) => {
    const ar = normalizeForSearch(s.ar).replace(/^ال/, '');
    const en = normalizeForSearch(s.en).replace(/^(al|an|ar|as|at|ad|adh|ash|az)\s/, '');
    return ar.includes(nq) || en.includes(nq) || normalizeForSearch(s.en).includes(nq);
  });
}
