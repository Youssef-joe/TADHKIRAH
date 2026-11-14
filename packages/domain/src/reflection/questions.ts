/**
 * Default daily-reflection questions (Module A). They're defined in code (text
 * lives in i18n `reflection.questions.<key>`) and provisioned per user, who can
 * hide, reorder or add their own. Gratitude, shortcomings/repentance and
 * tomorrow's intention are dedicated fields, not questions.
 */
export type AnswerType = 'yes_partly_no' | 'text' | 'both';
export type Choice = 'yes' | 'partly' | 'no' | 'prefer_not';

export interface CatalogQuestion {
  key: string;
  answerType: AnswerType;
  /** Suggest an answer from the day's worship log (the user always confirms). */
  prefill?: 'obligatory_prayer' | 'quran' | 'adhkar';
}

export const QUESTION_CATALOG: readonly CatalogQuestion[] = [
  { key: 'prayers_on_time', answerType: 'yes_partly_no', prefill: 'obligatory_prayer' },
  { key: 'quran_portion', answerType: 'yes_partly_no', prefill: 'quran' },
  { key: 'adhkar', answerType: 'yes_partly_no', prefill: 'adhkar' },
  { key: 'remembrance', answerType: 'yes_partly_no' },
  { key: 'tongue', answerType: 'yes_partly_no' },
  { key: 'rights', answerType: 'yes_partly_no' },
  { key: 'good_deed', answerType: 'text' },
];

export const QUESTION_BY_KEY: ReadonlyMap<string, CatalogQuestion> = new Map(
  QUESTION_CATALOG.map((q) => [q.key, q]),
);

export interface PrefillInput {
  /** Enabled obligatory prayers and their statuses for the day (null = not logged). */
  prayers: (string | null)[];
  /** Quran pages logged and the daily target, if any. */
  quran?: { amount: number; target: number | null };
  /** Morning / evening adhkar done flags. */
  adhkar?: { morning: boolean; evening: boolean };
}

/**
 * Suggests an answer from what the user already logged (REF-9). Returns null
 * when the log says nothing: we never guess, and never suggest "no" from an
 * empty log, because not logging isn't the same as not doing.
 */
export function suggestChoice(
  prefill: CatalogQuestion['prefill'],
  input: PrefillInput,
): Choice | null {
  switch (prefill) {
    case 'obligatory_prayer': {
      const relevant = input.prayers.filter((s) => s !== 'excused');
      if (!relevant.length) return null;
      const onTime = relevant.filter((s) => s === 'on_time').length;
      if (onTime === relevant.length) return 'yes';
      if (relevant.some((s) => s !== null)) return 'partly';
      return null;
    }
    case 'quran': {
      if (!input.quran || input.quran.amount <= 0) return null;
      return input.quran.target && input.quran.amount < input.quran.target ? 'partly' : 'yes';
    }
    case 'adhkar': {
      if (!input.adhkar) return null;
      const { morning, evening } = input.adhkar;
      if (morning && evening) return 'yes';
      if (morning || evening) return 'partly';
      return null;
    }
    default:
      return null;
  }
}
