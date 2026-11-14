'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { formatHijri, parseLocalDate, trackingDate } from '@tadhkirah/domain';

/**
 * Shows today's tracking day in Hijri and Gregorian. It runs on the client with the
 * shared domain package and the browser's timezone. Until the user sets a location,
 * the day starts at the 04:00 fallback (ADR-001).
 */
export function TodayDate() {
  const locale = useLocale() as 'ar' | 'en';
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const day = trackingDate(new Date(), { kind: 'unlocated', timeZone });
    const { year, month, day: d } = parseLocalDate(day);
    const gregorian = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(Date.UTC(year, month - 1, d, 12)));
    setLabel(`${gregorian} · ${formatHijri(day, locale)}`);
  }, [locale]);

  return (
    <p className="min-h-[1.5em] text-sm text-muted" aria-live="polite">
      {label}
    </p>
  );
}
