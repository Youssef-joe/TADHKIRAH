'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { QuranSummary } from '@tadhkirah/contracts';
import { surah } from '@tadhkirah/domain';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Icon } from '../ui/icons';

/** A gentle nudge on Today when memorized surahs are due for revision. Hidden otherwise. */
export function RevisionHint() {
  const t = useTranslations('quran');
  const locale = useLocale();
  const [due, setDue] = useState<QuranSummary['revisionDue']>([]);
  useEffect(() => {
    api<QuranSummary>('/quran/summary')
      .then((s) => setDue(s.revisionDue))
      .catch(() => undefined);
  }, []);
  if (!due.length) return null;
  const names = due
    .slice(0, 3)
    .map((d) => (locale === 'ar' ? surah(d.surah).ar : surah(d.surah).en));
  return (
    <Link
      href="/app/worship?tab=quran"
      className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm transition-colors hover:bg-accent/10"
    >
      <Icon name="book" className="shrink-0 text-accent" />
      <span className="flex-1">
        {t('dueHint', { surahs: names.join(locale === 'ar' ? '، ' : ', ') })}
      </span>
      <Icon name="arrow" size={16} flipInRtl className="text-accent" />
    </Link>
  );
}
