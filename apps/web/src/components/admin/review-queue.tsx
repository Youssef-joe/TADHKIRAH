'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card } from '../ui/primitives';

export type QueueItem = {
  type: 'hadiths' | 'sunnahs' | 'occasions';
  id: string;
  revision: number;
  label: string;
  lastVerifiedAt: string | null;
  reviewDueAt: string | null;
  state: 'scheduled' | 'due_soon' | 'due' | 'overdue';
  openReports: number;
};

export const REVIEW_STATE_STYLE: Record<QueueItem['state'], string> = {
  scheduled: 'bg-primary/10 text-primary',
  due_soon: 'bg-accent/15 text-accent',
  due: 'bg-accent/25 text-text',
  overdue: 'bg-danger/10 text-danger',
};

/**
 * The verification loop: published items due for a fresh check, or reported by
 * users. Reconfirming resets the clock; anything wrong goes through a revision.
 */
export function ReviewQueue() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  useEffect(() => {
    api<QueueItem[]>('/admin/review-queue').then(setItems, () => setItems([]));
  }, []);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        {t('reviewIntro')}
      </p>
      <Card title={t('nav_review')}>
        {items && !items.length && <p className="text-muted">{t('reviewEmpty')}</p>}
        <ul className="flex flex-col divide-y divide-border">
          {items?.map((i) => (
            <li key={i.id}>
              <Link
                href={`/admin/${i.type}/${i.id}`}
                className="flex flex-wrap items-center gap-3 py-3 hover:text-primary"
              >
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${REVIEW_STATE_STYLE[i.state]}`}
                >
                  {t(`reviewState_${i.state}`)}
                </span>
                <span className="font-medium">
                  <bdi>{i.label}</bdi>
                </span>
                <span className="text-sm text-muted">{t(`nav_${i.type}`)}</span>
                {i.openReports > 0 && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                    {t('reviewReports', { count: i.openReports })}
                  </span>
                )}
                <span className="ms-auto text-sm text-muted">
                  {i.reviewDueAt
                    ? t('reviewDue', { date: fmt.format(new Date(i.reviewDueAt)) })
                    : t('reviewNeverScheduled')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
