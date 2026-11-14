'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { shift } from '@/lib/use-worship';
import { Icon } from '../ui/icons';

/** Yesterday's intention, shown at the top of Today (REF-6). Hidden when there is none. */
export function IntentionCard() {
  const t = useTranslations('reflection');
  const [intention, setIntention] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { today } = await api<{ today: string }>('/worship/logs?from=2000-01-01&to=2000-01-01');
      const res = await api<{ intention: string | null }>(
        `/reflections/${shift(today, -1)}/intention`,
      );
      setIntention(res.intention);
    })().catch(() => undefined);
  }, []);
  if (!intention) return null;
  return (
    <div className="tk-rise flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-5 py-4">
      <Icon name="sunnah" className="mt-1 shrink-0 text-accent" />
      <div>
        <p className="mb-2 text-sm text-accent">{t('intentionToday')}</p>
        <p className="font-display text-xl leading-loose">{intention}</p>
      </div>
    </div>
  );
}

/** The evening invitation to reflect, with today's status. */
export function ReflectionCard() {
  const t = useTranslations('reflection');
  const [status, setStatus] = useState<'none' | 'draft' | 'done' | null>(null);
  useEffect(() => {
    (async () => {
      const { today } = await api<{ today: string }>('/worship/logs?from=2000-01-01&to=2000-01-01');
      const list = await api<{ completedAt: string | null }[]>(
        `/reflections?from=${today}&to=${today}`,
      );
      setStatus(list[0] ? (list[0].completedAt ? 'done' : 'draft') : 'none');
    })().catch(() => setStatus('none'));
  }, []);
  return (
    <Link
      href="/app/reflection"
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 px-5 py-5 transition-shadow hover:shadow-lg"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-transform group-hover:scale-105">
        <Icon name="reflection" size={24} />
      </span>
      <div className="flex-1">
        <p className="font-semibold">
          {status === 'done' ? t('todayCardDone') : t('todayCardTitle')}
        </p>
        {status !== 'done' && <p className="text-sm text-muted">{t('todayCardBody')}</p>}
      </div>
      {status !== 'done' && (
        <span className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex">
          {status === 'draft' ? t('todayCardContinue') : t('todayCardCta')}
          <Icon name="arrow" size={16} flipInRtl />
        </span>
      )}
    </Link>
  );
}
