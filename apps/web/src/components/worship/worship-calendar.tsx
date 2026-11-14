'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { consistency, dayState, type DayState, type LocalDate } from '@tadhkirah/domain';
import { logKey, shift, useWorship } from '@/lib/use-worship';
import type { DayFlagsDto, LogDto } from '@/lib/worship-types';
import { useMe } from '../me-context';
import { Icon } from '../ui/icons';
import { Select } from '../ui/primitives';
import { numberFormatter, useActivityName } from './names';

const CELL: Record<DayState, string> = {
  logged: 'bg-primary text-white shadow-sm',
  partial: 'bg-primary/35 text-text',
  not_logged: 'border border-border text-muted',
  excused: 'bg-excused/40 text-text',
  not_scheduled: 'text-muted/50',
  future: 'text-muted/40',
};

function monthBounds(ym: string): { from: string; to: string; days: number } {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(days).padStart(2, '0')}`, days };
}

/**
 * Month calendar per activity (WOR-9). Shows presence and gentle states only:
 * no streak counters, no red, no score. Excused days are shown neutrally.
 */
export function WorshipCalendar() {
  const t = useTranslations('worship');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const name = useActivityName();
  const fmt = numberFormatter(locale, me.profile.digits);
  const [month, setMonth] = useState<string | null>(null);
  const { from, to, days } = month ? monthBounds(month) : { from: null, to: null, days: 0 };
  const w = useWorship(from, to);
  const [activityId, setActivityId] = useState<string | null>(null);

  // Start on the current month (from the server's notion of "today").
  useEffect(() => {
    if (!month && w.today) setMonth(w.today.slice(0, 7));
  }, [month, w.today]);

  const enabled = w.activities.filter((a) => a.enabled);
  const activity = enabled.find((a) => a.id === activityId) ?? enabled[0];

  const weekdayNames = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    // 2026-11-15 is a Sunday (index 0).
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 10, 15 + i))));
  }, [locale]);

  if (!month || !w.today || !activity) {
    return (
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" aria-busy />
    );
  }

  const weekStart = me.preferences.weekStart;
  const firstWeekday = new Date(`${from}T12:00:00Z`).getUTCDay();
  const lead = (firstWeekday - weekStart + 7) % 7;
  const today = w.today as LocalDate;

  const logMap = new Map<LocalDate, LogDto>();
  const flagMap = new Map<LocalDate, DayFlagsDto>();
  for (let i = 0; i < days; i++) {
    const d = shift(from!, i) as LocalDate;
    const l = w.logs.get(logKey(d, activity.id));
    if (l) logMap.set(d, l);
    const f = w.flags.get(d);
    if (f) flagMap.set(d, f);
  }
  const summary = consistency(activity, from as LocalDate, to as LocalDate, today, logMap, flagMap);
  const monthLabel = new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${from}T12:00:00Z`));
  const nextMonth = shift(to!, 1).slice(0, 7);

  return (
    <div className="flex flex-col gap-5">
      <Select
        aria-label={t('chooseActivity')}
        value={activity.id}
        onChange={(e) => setActivityId(e.target.value)}
      >
        {enabled.map((a) => (
          <option key={a.id} value={a.id}>
            {name(a)}
          </option>
        ))}
      </Select>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label={t('prevMonth')}
            onClick={() => setMonth(shift(from!, -1).slice(0, 7))}
            className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary"
          >
            <Icon name="arrow" size={16} className="rotate-180 rtl:rotate-0" />
          </button>
          <h2 className="font-display text-xl font-bold">{monthLabel}</h2>
          <button
            type="button"
            aria-label={t('nextMonth')}
            disabled={nextMonth > today.slice(0, 7)}
            onClick={() => setMonth(nextMonth)}
            className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary disabled:opacity-40"
          >
            <Icon name="arrow" size={16} flipInRtl />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>{weekdayNames[(weekStart + i) % 7]}</span>
          ))}
        </div>
        <ol className="mt-1.5 grid grid-cols-7 gap-1.5" key={`${month}-${activity.id}`}>
          {Array.from({ length: lead }, (_, i) => (
            <li key={`lead-${i}`} aria-hidden />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = shift(from!, i) as LocalDate;
            const state = dayState(activity, d, today, logMap.get(d), flagMap.get(d));
            return (
              <li
                key={d}
                className={`tk-cell flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums ${CELL[state]} ${d === today ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                style={{ animationDelay: `${i * 12}ms` }}
                aria-label={`${fmt(i + 1)}: ${t(`legend.${state}`)}`}
              >
                {fmt(i + 1)}
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
          {(['logged', 'partial', 'not_logged', 'excused'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`size-3.5 rounded ${CELL[s]}`} />
              {t(`legend.${s}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-lg">
          {t('summary', {
            count: summary.eligible,
            logged: fmt(summary.logged),
            eligible: fmt(summary.eligible),
          })}
        </p>
        {summary.excused > 0 && (
          <p className="mt-1 text-sm text-muted">
            {t('summaryExcused', { count: summary.excused, n: fmt(summary.excused) })}
          </p>
        )}
        <p className="mt-3 text-sm text-muted">{t('gentle')}</p>
      </div>
    </div>
  );
}
