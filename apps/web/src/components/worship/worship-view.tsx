'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuranPanel } from '../quran/quran-panel';
import { useTranslations } from 'next-intl';
import { Icon } from '../ui/icons';
import { WorshipCalendar } from './worship-calendar';
import { WorshipCustomize } from './worship-customize';

/** My Worship: month calendars per activity, and customization. */
export function WorshipView() {
  const t = useTranslations('worship');
  const tq = useTranslations('quran');
  const initial = useSearchParams().get('tab');
  const [tab, setTab] = useState<'calendar' | 'quran' | 'customize'>(
    initial === 'quran' || initial === 'customize' ? initial : 'calendar',
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon name="worship" size={24} />
        </span>
        {t('title')}
      </h1>
      <div role="tablist" className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(['calendar', 'quran', 'customize'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors aria-selected:bg-primary aria-selected:text-white"
          >
            {k === 'quran' ? tq('tab') : t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'calendar' && <WorshipCalendar />}
        {tab === 'quran' && <QuranPanel />}
        {tab === 'customize' && <WorshipCustomize />}
      </div>
    </div>
  );
}
