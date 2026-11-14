'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatHijri, isScheduled } from '@tadhkirah/domain';
import { Link } from '@/i18n/navigation';
import { logKey, shift, useWorship } from '@/lib/use-worship';
import type { ActivityDto } from '@/lib/worship-types';
import { useMe } from '../me-context';
import { Icon } from '../ui/icons';
import { Status } from '../ui/primitives';
import { CountStepper, DoneToggle, PrayerStatusControl } from './controls';
import { numberFormatter, useActivityName } from './names';

const GROUPS = ['voluntary_prayer', 'adhkar', 'quran', 'fasting', 'custom'] as const;

/**
 * Today's worship (M3): log prayers with a status, voluntary acts with a tap or
 * a number, and mark the day excused or travelling. You can step back through
 * the days you're still allowed to edit (default 7).
 */
export function TodayWorship() {
  const t = useTranslations('worship');
  const tc = useTranslations('worship.categories');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const name = useActivityName();
  const fmt = numberFormatter(locale, me.profile.digits);
  const w = useWorship(null, null);
  const [offset, setOffset] = useState(0); // 0 = today, -1 = yesterday, …

  const date = w.today ? shift(w.today, offset) : null;
  const flags = (date && w.flags.get(date)) || { excused: false, travelling: false };

  const visible = useMemo(
    () => (date ? w.activities.filter((a) => a.enabled && isScheduled(a.schedule, date)) : []),
    [w.activities, date],
  );
  const obligatory = visible.filter((a) => a.obligation === 'obligatory');

  if (w.loading || !date) {
    return (
      <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" aria-busy />
    );
  }

  const dateLabel = (() => {
    const g = new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${date}T12:00:00Z`));
    return `${g} · ${formatHijri(date, locale, { offsetDays: me.preferences.hijriOffset, digits: me.profile.digits })}`;
  })();

  const row = (a: ActivityDto) => {
    const log = w.logs.get(logKey(date, a.id));
    const label = name(a);
    return (
      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <span className="font-medium">{label}</span>
        {a.measure === 'prayer_status' && (
          <PrayerStatusControl
            label={label}
            value={log?.prayerStatus ?? null}
            onChange={(v) => w.setLog(date, a.id, v ? { prayerStatus: v } : null)}
          />
        )}
        {a.measure === 'boolean' && (
          <DoneToggle
            label={label}
            value={log?.done === true}
            onChange={(v) => w.setLog(date, a.id, v ? { done: true } : null)}
          />
        )}
        {a.measure === 'count' && (
          <CountStepper
            label={label}
            activity={a}
            value={log?.amount ?? 0}
            format={fmt}
            onChange={(v) => w.setLog(date, a.id, v > 0 ? { amount: v } : null)}
          />
        )}
      </li>
    );
  };

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-5"
      aria-labelledby="today-worship"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="today-worship" className="flex items-center gap-2 text-lg font-semibold">
          <Icon name="worship" className="text-primary" /> {t('todayTitle')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('prevDay')}
            disabled={offset <= -w.backfillDays}
            onClick={() => setOffset((o) => o - 1)}
            className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary disabled:opacity-40"
          >
            <Icon name="arrow" size={16} className="rotate-180 rtl:rotate-0" />
          </button>
          <button
            type="button"
            aria-label={t('nextDay')}
            disabled={offset >= 0}
            onClick={() => setOffset((o) => o + 1)}
            className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary disabled:opacity-40"
          >
            <Icon name="arrow" size={16} flipInRtl />
          </button>
        </div>
      </div>
      <p className="-mt-2 mb-4 text-sm text-muted">
        {offset === 0 ? `${t('today')} · ` : ''}
        {dateLabel}
        {offset !== 0 && (
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="ms-2 text-primary hover:underline"
          >
            {t('backToToday')}
          </button>
        )}
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-excused has-checked:bg-excused/20">
          <input
            type="checkbox"
            className="accent-[var(--excused)]"
            checked={flags.excused}
            onChange={(e) => w.setFlags(date, { ...flags, excused: e.target.checked })}
          />
          {t('excusedToday')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/10">
          <input
            type="checkbox"
            className="accent-[var(--primary)]"
            checked={flags.travelling}
            onChange={(e) => w.setFlags(date, { ...flags, travelling: e.target.checked })}
          />
          {t('travelling')}
        </label>
      </div>
      {flags.excused && <p className="mb-2 text-xs text-muted">{t('excusedHint')}</p>}

      <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
        {tc('obligatory_prayer')}
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px]">
          {t('obligatory')}
        </span>
      </h3>
      <ul
        className={`divide-y divide-border transition-opacity ${flags.excused ? 'opacity-60' : ''}`}
      >
        {obligatory.map(row)}
      </ul>

      {GROUPS.map((g) => {
        const items = visible.filter((a) => a.category === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-accent">
              {tc(g)}
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px]">
                {t('voluntary')}
              </span>
            </h3>
            <ul className="divide-y divide-border">{items.map(row)}</ul>
          </div>
        );
      })}

      {w.saveError && (
        <div className="mt-3">
          <Status tone="error">{t('saveError')}</Status>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Link
          href="/app/worship"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {t('tabs.calendar')} · {t('tabs.customize')}
          <Icon name="arrow" size={14} flipInRtl />
        </Link>
      </div>
    </section>
  );
}
