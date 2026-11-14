'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { InboxItem } from '@tadhkirah/contracts';
import { Link, useRouter } from '@/i18n/navigation';
import { api, errorKey } from '@/lib/api';
import { timeFormatter } from '@/lib/format';
import { useMe } from '../me-context';
import { Button, Card, Status } from '../ui/primitives';

const PATHS: Record<InboxItem['category'], string> = {
  prayer: '/app/today',
  adhkar_morning: '/app/today',
  adhkar_evening: '/app/today',
  quran: '/app/today',
  reflection: '/app/reflection',
  weekly_review: '/app/reports',
  custom: '/app/today',
};

/** Reminders from the last 30 days (NOT-5): a calm list, never a pile of "missed" items. */
export function InboxView() {
  const t = useTranslations('inbox');
  const tr = useTranslations('reminders');
  const tp = useTranslations('prayers');
  const te = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const { me } = useMe();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api<InboxItem[]>('/notifications').then(setItems, (err) => {
      setItems([]);
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    });
  }, [te]);

  const { digits, timezone } = me.profile;
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(`${locale}-u-nu-${digits}`, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: timezone,
      }),
    [locale, digits, timezone],
  );
  const timeFmt = useMemo(
    () => timeFormatter(locale, digits, timezone),
    [locale, digits, timezone],
  );
  const nf = useMemo(() => new Intl.NumberFormat(`${locale}-u-nu-${digits}`), [locale, digits]);

  const title = (i: InboxItem) =>
    i.category === 'custom'
      ? (i.customTitle ?? tr('cat_custom'))
      : i.category === 'prayer' && i.params.prayer
        ? tr('prayerRule', { prayer: tp(i.params.prayer as 'fajr') })
        : tr(`cat_${i.category}` as 'cat_quran');

  function markOpened(i: InboxItem) {
    if (i.openedAt) return;
    setItems(
      (all) =>
        all?.map((x) => (x.id === i.id ? { ...x, openedAt: new Date().toISOString() } : x)) ?? null,
    );
    void api(`/notifications/${i.id}/opened`, { method: 'POST' }).catch(() => undefined);
  }

  async function snooze(i: InboxItem) {
    try {
      const { fireAt } = await api<{ fireAt: string }>(`/reminders/${i.scheduledId}/snooze`, {
        method: 'POST',
        body: { minutes: 10 },
      });
      markOpened(i);
      setStatus({ tone: 'ok', text: t('snoozed', { time: timeFmt.format(new Date(fireAt)) }) });
    } catch (err) {
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    }
  }

  const minutes = tr('minutes', { n: 10, count: nf.format(10) });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted">{t('intro')}</p>
      </div>
      {status && <Status tone={status.tone}>{status.text}</Status>}
      <Card>
        {items && items.length === 0 ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items?.map((i) => {
              const sent = new Date(i.sentAt);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {title(i)}
                      {!i.openedAt && (
                        <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {t('new')}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {dateFmt.format(sent)} ·{' '}
                      <bdi className="tabular-nums">{timeFmt.format(sent)}</bdi>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      markOpened(i);
                      router.push(PATHS[i.category]);
                    }}
                  >
                    {t('open')}
                  </Button>
                  {i.scheduledId && !i.openedAt && Date.now() - sent.getTime() < 6 * 3_600_000 && (
                    <Button variant="quiet" onClick={() => snooze(i)}>
                      {t('snooze', { minutes })}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Link
        href="/app/settings#reminders"
        className="self-start text-primary underline-offset-4 hover:underline"
      >
        {t('settings')}
      </Link>
    </div>
  );
}
