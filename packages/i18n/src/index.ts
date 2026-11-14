export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

/** Arabic first (ADR-002: Middle East first). */
export const defaultLocale: Locale = 'ar';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
