'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { formatHijri, parseLocalDate, trackingDate } from '@tadhkirah/domain';
import { Link } from '@/i18n/navigation';
import { useMe } from './me-context';
import { Card } from './ui/primitives';

/**
 * The Today page as of M1: a greeting, the tracking day in Hijri and Gregorian
 * (in the user's own timezone and numerals), and what is coming next.
 */
export function TodayView() {
  const t = useTranslations('today');
  const ts = useTranslations('shell');
  const tn = useTranslations('nav');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    const { timezone, digits } = me.profile;
    // No location yet (M2), so the day starts at the 04:00 fallback (ADR-001).
    const day = trackingDate(new Date(), { kind: 'unlocated', timeZone: timezone });
    const { year, month, day: d } = parseLocalDate(day);
    const gregorian = new Intl.DateTimeFormat(`${locale}-u-nu-${digits}`, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(Date.UTC(year, month - 1, d, 12)));
    const hijri = formatHijri(day, locale, { offsetDays: me.preferences.hijriOffset, digits });
    setDateLabel(`${gregorian} · ${hijri}`);
  }, [me, locale]);

  const name = me.profile.displayName;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary">
          {name ? ts('greeting', { name }) : ts('greetingNoName')}
        </h1>
        <p className="mt-1 min-h-[1.5em] text-muted" aria-live="polite">
          {dateLabel}
        </p>
      </header>

      <Card>
        <p className="leading-relaxed">{t('intro')}</p>
        <p className="mt-3 text-sm text-muted">
          {t('dayStartsAtFajr')} {t('setLocation')}
        </p>
      </Card>

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-3 text-sm font-medium text-muted">
          {t('upcoming')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {(['worship', 'reflection', 'reports'] as const).map((k) => (
            <li key={k}>
              <Link
                href={`/app/${k}`}
                className="block rounded-lg border border-dashed border-border px-4 py-3 text-muted hover:bg-surface"
              >
                {tn(k)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
