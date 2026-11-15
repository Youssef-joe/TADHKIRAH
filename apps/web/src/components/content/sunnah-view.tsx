'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicSunnah } from '@tadhkirah/contracts';
import { api } from '@/lib/api';
import { Icon } from '../ui/icons';
import { Differences, HadithEvidence, LastVerified, ReportProblem } from './evidence';

const ORDER: PublicSunnah['trigger'][] = [
  'on_waking',
  'daily',
  'eating',
  'entering_mosque',
  'friday',
  'before_sleep',
];

/** Published Sunnahs only, each with its evidence (Module D). */
export function SunnahView() {
  const t = useTranslations('content');
  const locale = useLocale();
  const [items, setItems] = useState<PublicSunnah[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api<PublicSunnah[]>('/content/sunnahs').then(setItems, () => setError(true));
  }, []);

  const groups = ORDER.map((trigger) => ({
    trigger,
    items: items?.filter((s) => s.trigger === trigger) ?? [],
  })).filter((g) => g.items.length);
  const ar = locale === 'ar';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon name="sunnah" size={26} />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">{t('sunnahTitle')}</h1>
          <p className="text-muted">{t('sunnahIntro')}</p>
        </div>
      </header>
      {error && <p className="text-danger">{t('loadError')}</p>}
      {items && !items.length && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted">
          {t('sunnahEmpty')}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.trigger} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-primary">{t(`trigger_${g.trigger}`)}</h2>
          {g.items.map((s) => (
            <article
              key={s.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
            >
              <div>
                <h3 className="text-xl font-semibold">{ar ? s.titleAr : s.titleEn}</h3>
                {s.classification === 'less_commonly_practiced' && (
                  <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {t('lessCommon')}
                  </span>
                )}
              </div>
              <p className="leading-relaxed">{ar ? s.descriptionAr : s.descriptionEn}</p>
              {(ar ? s.instructionsAr : s.instructionsEn) && (
                <div>
                  <p className="mb-1 text-sm font-medium text-muted">{t('instructions')}</p>
                  <p className="leading-relaxed whitespace-pre-line">
                    {ar ? s.instructionsAr : s.instructionsEn}
                  </p>
                </div>
              )}
              <Differences items={s.differences} />
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted">{t('evidence')}</p>
                {s.hadiths.map((h) => (
                  <HadithEvidence key={h.id} h={h} />
                ))}
              </div>
              <LastVerified at={s.lastVerifiedAt} />
              <ReportProblem subjectType="sunnah" subjectId={s.id} />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
