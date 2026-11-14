/**
 * The built-in worship catalog (Module B). It's defined in code rather than the
 * database: it's small, versioned with the app, works offline, and is shared by
 * web, API and mobile. Names live in i18n (`worship.activities.<key>`).
 *
 * Product rule: obligatory and voluntary acts are always clearly separated, and
 * voluntary acts are never presented as obligatory.
 */

export const CATEGORIES = [
  'obligatory_prayer',
  'voluntary_prayer',
  'adhkar',
  'quran',
  'fasting',
  'custom',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Obligation = 'obligatory' | 'voluntary';
export type Measure = 'prayer_status' | 'boolean' | 'count';
export const UNITS = ['pages', 'rakah', 'prayers', 'times'] as const;
export type Unit = (typeof UNITS)[number];

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { type: 'times_per_week'; n: number };

export interface CatalogActivity {
  key: string;
  category: Exclude<Category, 'custom'>;
  obligation: Obligation;
  measure: Measure;
  unit?: Unit;
  /** Upper bound for count inputs (e.g. after-prayer adhkar can't exceed 5). */
  max?: number;
  schedule: Schedule;
  /** Enabled for new users by default. */
  defaultEnabled: boolean;
}

const daily: Schedule = { type: 'daily' };

export const CATALOG: readonly CatalogActivity[] = [
  {
    key: 'fajr',
    category: 'obligatory_prayer',
    obligation: 'obligatory',
    measure: 'prayer_status',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'dhuhr',
    category: 'obligatory_prayer',
    obligation: 'obligatory',
    measure: 'prayer_status',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'asr',
    category: 'obligatory_prayer',
    obligation: 'obligatory',
    measure: 'prayer_status',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'maghrib',
    category: 'obligatory_prayer',
    obligation: 'obligatory',
    measure: 'prayer_status',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'isha',
    category: 'obligatory_prayer',
    obligation: 'obligatory',
    measure: 'prayer_status',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'rawatib',
    category: 'voluntary_prayer',
    obligation: 'voluntary',
    measure: 'count',
    unit: 'rakah',
    max: 20,
    schedule: daily,
    defaultEnabled: false,
  },
  {
    key: 'witr',
    category: 'voluntary_prayer',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'duha',
    category: 'voluntary_prayer',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: daily,
    defaultEnabled: false,
  },
  {
    key: 'qiyam',
    category: 'voluntary_prayer',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: daily,
    defaultEnabled: false,
  },
  {
    key: 'morning_adhkar',
    category: 'adhkar',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'evening_adhkar',
    category: 'adhkar',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'after_prayer_adhkar',
    category: 'adhkar',
    obligation: 'voluntary',
    measure: 'count',
    unit: 'prayers',
    max: 5,
    schedule: daily,
    defaultEnabled: false,
  },
  {
    key: 'sleep_adhkar',
    category: 'adhkar',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: daily,
    defaultEnabled: false,
  },
  {
    key: 'quran_pages',
    category: 'quran',
    obligation: 'voluntary',
    measure: 'count',
    unit: 'pages',
    max: 604,
    schedule: daily,
    defaultEnabled: true,
  },
  {
    key: 'voluntary_fast',
    category: 'fasting',
    obligation: 'voluntary',
    measure: 'boolean',
    schedule: { type: 'weekdays', days: [1, 4] },
    defaultEnabled: false,
  },
];

export const CATALOG_BY_KEY: ReadonlyMap<string, CatalogActivity> = new Map(
  CATALOG.map((a) => [a.key, a]),
);

/**
 * Categories whose days are left out of consistency counts when the user marks
 * the day as excused (e.g. menstruation or illness exempts prayer and fasting,
 * but not adhkar or Quran).
 */
export const EXCUSABLE_CATEGORIES: ReadonlySet<Category> = new Set([
  'obligatory_prayer',
  'voluntary_prayer',
  'fasting',
]);
