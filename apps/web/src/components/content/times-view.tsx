'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicOccasion } from '@tadhkirah/contracts';
import {
  occasionTiming,
  toPrayerLocation,
  trackingDate,
  type OccasionTiming,
} from '@tadhkirah/domain';
import { api } from '@/lib/api';
import { timeFormatter } from '@/lib/format';
import { useMe } from '../me-context';
import { Icon } from '../ui/icons';
import { Differences, HadithEvidence, ReportProblem } from './evidence';

/**
 * Times of acceptance (Module C): each published occasion with its period for
 * today, computed from the user's prayer times. Periods stay periods; nothing
 * shows an invented exact minute (policy §7.3).
 */
export function TimesView() {
  const t = useTranslations('content');
  const tp = useTranslations('prayers');
  const locale = useLocale();
  const { me } = useMe();
  const [items, setItems] = useState<PublicOccasion[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    api<PublicOccasion[]>('/content/supplication-occasions').then(setItems, () => setError(true));
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { timezone, digits } = me.profile;
  const loc = useMemo(() => {
    const s = me.prayerSettings;
    return s
      ? toPrayerLocation(
          { ...s, asrMethod: s.asrMethod ?? 'standard', adjustments: s.adjustments ?? {} },
          timezone,
        )
      : null;
  }, [me.prayerSettings, timezone]);
  const day = useMemo(
    () => (loc ? trackingDate(new Date(now), { kind: 'located', ...loc }) : null),
    [loc, now],
  );
  const fmt = useMemo(() => timeFormatter(locale, digits, timezone), [locale, digits, timezone]);
  const ar = locale === 'ar';

  function timingLine(timing: OccasionTiming) {
    switch (timing.kind) {
      case 'period': {
        const active = now >= timing.start.getTime() && now < timing.end.getTime();
        return (
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <Icon name="clock" size={18} className="text-primary" />
            <bdi className="tabular-nums">
              {t('timing_period', { start: fmt.format(timing.start), end: fmt.format(timing.end) })}
            </bdi>
            {active && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                {t('now')}
              </span>
            )}
          </p>
        );
      }
      case 'from':
        return (
          <p className="flex items-center gap-2 font-medium">
            <Icon name="clock" size={18} className="text-primary" />
            <bdi>{t('timing_from', { start: fmt.format(timing.start) })}</bdi>
          </p>
        );
      case 'after_adhans':
        return (
          <div>
            <p className="mb-2 font-medium">{t('timing_after_adhans')}</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {timing.adhans.map((a) => (
                <li key={a.prayer} className="rounded-full border border-border px-3 py-1">
                  {tp(a.prayer)} <bdi className="tabular-nums text-muted">{fmt.format(a.at)}</bdi>
                </li>
              ))}
            </ul>
          </div>
        );
      case 'described':
        return <p className="font-medium">{t('timing_described')}</p>;
      case 'fridays_only':
        return <p className="text-muted">{t('timing_fridays_only')}</p>;
      default:
        return <p className="text-muted">{t('timing_guidance')}</p>;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon name="times" size={26} />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">{t('timesTitle')}</h1>
          <p className="text-muted">{t('timesIntro')}</p>
        </div>
      </header>
      {error && <p className="text-danger">{t('loadError')}</p>}
      {items && !items.length && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted">
          {t('timesEmpty')}
        </p>
      )}
      {items?.map((o) => (
        <article
          key={o.id}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 className="text-xl font-semibold">{ar ? o.titleAr : o.titleEn}</h2>
          {loc && day && timingLine(occasionTiming(o.window, day, loc))}
          {o.evidenceType === 'scholarly_interpretation' && (
            <p className="text-sm text-accent">{t('scholarlyTiming')}</p>
          )}
          <p className="leading-relaxed">{ar ? o.explanationAr : o.explanationEn}</p>
          <Differences items={o.differences} />
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted">{t('evidence')}</p>
            {o.hadiths.map((h) => (
              <HadithEvidence key={h.id} h={h} />
            ))}
          </div>
          <ReportProblem subjectType="occasion" subjectId={o.id} />
        </article>
      ))}
    </div>
  );
}
