import { addDays, parseLocalDate, type LocalDate } from './dates.js';

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

const numericFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/**
 * The Umm al-Qura Hijri date for a tracking day. `offsetDays` (−2…+2) lets users
 * match their local moon sighting.
 */
export function toHijri(date: LocalDate, offsetDays = 0): HijriDate {
  if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > 2) {
    throw new RangeError('Hijri offset must be an integer between -2 and 2');
  }
  const { year, month, day } = parseLocalDate(addDays(date, offsetDays));
  const parts = numericFormatter.formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number.parseInt(parts.find((p) => p.type === t)?.value ?? '', 10);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** A localized Hijri date string, e.g. "٣ جمادى الآخرة ١٤٤٨ هـ". */
export function formatHijri(
  date: LocalDate,
  locale: 'ar' | 'en',
  opts: { offsetDays?: number; digits?: 'arab' | 'latn' } = {},
): string {
  const { year, month, day } = parseLocalDate(addDays(date, opts.offsetDays ?? 0));
  const nu = opts.digits ?? (locale === 'ar' ? 'arab' : 'latn');
  return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura-nu-${nu}`, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
