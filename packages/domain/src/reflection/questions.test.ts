import { describe, expect, it } from 'vitest';
import { QUESTION_CATALOG, suggestChoice } from './questions.js';

describe('reflection questions', () => {
  it('has unique keys', () => {
    expect(new Set(QUESTION_CATALOG.map((q) => q.key)).size).toBe(QUESTION_CATALOG.length);
  });

  it('suggests prayer answers from the log, never "no" from an empty log', () => {
    const p = (prayers: (string | null)[]) => suggestChoice('obligatory_prayer', { prayers });
    expect(p(['on_time', 'on_time', 'on_time', 'on_time', 'on_time'])).toBe('yes');
    expect(p(['on_time', 'later', null, null, null])).toBe('partly');
    expect(p([null, null, null, null, null])).toBeNull();
    expect(p(['excused', 'excused', 'excused', 'excused', 'excused'])).toBeNull();
    expect(p(['on_time', 'excused', 'on_time', 'on_time', 'on_time'])).toBe('yes');
  });

  it('suggests Quran and adhkar answers', () => {
    expect(suggestChoice('quran', { prayers: [], quran: { amount: 5, target: 5 } })).toBe('yes');
    expect(suggestChoice('quran', { prayers: [], quran: { amount: 2, target: 5 } })).toBe('partly');
    expect(suggestChoice('quran', { prayers: [], quran: { amount: 0, target: null } })).toBeNull();
    expect(
      suggestChoice('adhkar', { prayers: [], adhkar: { morning: true, evening: false } }),
    ).toBe('partly');
    expect(suggestChoice('adhkar', { prayers: [], adhkar: { morning: true, evening: true } })).toBe(
      'yes',
    );
    expect(
      suggestChoice('adhkar', { prayers: [], adhkar: { morning: false, evening: false } }),
    ).toBeNull();
    expect(suggestChoice(undefined, { prayers: [] })).toBeNull();
  });
});
