'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ActivityReport, MonthlyReport } from '@tadhkirah/contracts';
import {
  addDays,
  parseLocalDate,
  shiftMonth,
  toHijri,
  weekday,
  type DayState,
  type LocalDate,
  type ReportCalendar,
} from '@tadhkirah/domain';
import { api } from '@/lib/api';
import { useMe } from '../me-context';
import { Icon } from '../ui/icons';
import { Reveal } from '../ui/reveal';
import { CELL as DAY_CELL } from '../worship/worship-calendar';
import { numberFormatter, useActivityName } from '../worship/names';
import { Tile } from './tiles';

const STORAGE_KEY = 'tk.reportCalendar';
const REFLECTION = 'reflection';

function savedCalendar(locale: string): ReportCalendar {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'hijri' || v === 'gregorian') return v;
  } catch {
    // Storage can be unavailable (private mode); fall back to the locale default.
  }
  return locale === 'ar' ? 'hijri' : 'gregorian';
}

/**
 * Monthly report (REP-7): the weekly structure over a whole month, in the Hijri
 * or Gregorian calendar, with a month calendar for one activity at a time.
 * Counts only: no score, no percentage, no comparison.
 */
export function MonthReport() {
  const t = useTranslations('reports');
  const tw = useTranslations('worship');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const fmt = numberFormatter(locale, me.profile.digits);
  const name = useActivityName();
  const offset = me.preferences.hijriOffset;

  const [calendar, setCalendar] = useState<ReportCalendar | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [subject, setSubject] = useState<string | null>(null);

  useEffect(() => setCalendar(savedCalendar(locale)), [locale]);

  const load = useCallback(async (cal: ReportCalendar, m: string | null) => {
    const q = new URLSearchParams({ calendar: cal, ...(m ? { month: m } : {}) });
    setReport(await api<MonthlyReport>(`/reports/monthly?${q}`));
  }, []);
  useEffect(() => {
    if (calendar) void load(calendar, month);
  }, [calendar, month, load]);

  const weekdayNames = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
    // 2026-11-15 is a Sunday (index 0).
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 10, 15 + i))));
  }, [locale]);

  if (!report || !calendar)
    return (
      <div
        className="h-[36rem] animate-pulse rounded-2xl border border-border bg-surface"
        aria-busy
      />
    );

  const switchCalendar = (c: ReportCalendar) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // Not remembered this time; nothing else depends on it.
    }
    setReport(null);
    setMonth(null);
    setCalendar(c);
  };

  const intl = (cal: ReportCalendar, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(
      `${locale}-u-nu-${me.profile.digits}${cal === 'hijri' ? '-ca-islamic-umalqura' : ''}`,
      { timeZone: 'UTC', ...opts },
    );
  const at = (d: string, shiftDays = 0) =>
    new Date(`${addDays(d as LocalDate, shiftDays)}T12:00:00Z`);
  const shownOffset = calendar === 'hijri' ? offset : 0;
  const title = intl(calendar, { month: 'long', year: 'numeric' }).format(
    at(report.start, shownOffset),
  );
  // The same month in the other calendar, e.g. "18 Feb – 19 Mar 2026" under "Ramadan 1447".
  const other: ReportCalendar = calendar === 'hijri' ? 'gregorian' : 'hijri';
  const otherOffset = other === 'hijri' ? offset : 0;
  const otherFmt = intl(other, { day: 'numeric', month: 'short', year: 'numeric' });
  const otherRange = `${otherFmt.format(at(report.start, otherOffset))} – ${otherFmt.format(at(report.end, otherOffset))}`;
  const dayNumber = (d: LocalDate) =>
    calendar === 'hijri' ? toHijri(d, offset).day : parseLocalDate(d).day;

  const reflectionDays: DayState[] = report.days.map((d, i) =>
    d > report.today ? 'future' : report.reflections.perDay[i] ? 'logged' : 'not_logged',
  );
  const selected =
    report.activities.find((a) => a.activityId === subject) ??
    (subject === REFLECTION ? null : report.activities[0]);
  const perDay: DayState[] = selected ? selected.perDay : reflectionDays;
  const selectedName = selected ? name(selected) : t('reflectionRow');
  const lead = (weekday(report.start as LocalDate) - me.preferences.weekStart + 7) % 7;

  const attention = report.activities
    .filter((a) => a.needsAttention)
    .sort((x, y) => x.logged / x.eligible - y.logged / y.eligible)
    .slice(0, 3);
  const obligatory = report.activities.filter((a) => a.obligation === 'obligatory');
  const voluntary = report.activities.filter((a) => a.obligation === 'voluntary');
  const reflectionEligible = reflectionDays.filter((s) => s !== 'future').length;

  const row = (id: string, label: string, logged: number, eligible: number, a?: ActivityReport) => (
    <li key={id}>
      <button
        type="button"
        aria-pressed={(selected?.activityId ?? REFLECTION) === id}
        onClick={() => setSubject(id)}
        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 text-start transition-colors hover:bg-primary/5 aria-pressed:bg-primary/10"
      >
        <span>
          <span className="font-medium">{label}</span>
          {a?.statusBreakdown && (
            <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
              <span>
                {tw('status.on_time')} {fmt(a.statusBreakdown.on_time)}
              </span>
              {a.statusBreakdown.later > 0 && (
                <span>
                  {tw('status.later')} {fmt(a.statusBreakdown.later)}
                </span>
              )}
              {a.statusBreakdown.qada > 0 && (
                <span>
                  {tw('status.qada')} {fmt(a.statusBreakdown.qada)}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="text-sm tabular-nums text-muted">
          {t('ofDays', { logged: fmt(logged), eligible: fmt(eligible) })}
        </span>
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon name="reports" size={24} />
            </span>
            {t('monthTitle')}
          </h1>
          <p className="mt-2 text-lg font-medium">
            {report.isCurrentMonth ? `${t('thisMonth')} · ` : ''}
            {title}
          </p>
          <p className="text-sm text-muted">{otherRange}</p>
          <p className="text-sm text-muted">
            {t('excusedDays', { count: report.excusedDays, n: fmt(report.excusedDays) })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            role="group"
            aria-label={t('calendarLabel')}
            className="flex gap-1 rounded-full border border-border p-0.5 text-sm"
          >
            {(['hijri', 'gregorian'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={calendar === c}
                onClick={() => calendar !== c && switchCalendar(c)}
                className="rounded-full px-3 py-1 text-muted transition-colors aria-pressed:bg-primary aria-pressed:text-white"
              >
                {t(`calendar.${c}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('prevMonth')}
              onClick={() => setMonth(shiftMonth(report.month, -1))}
              className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary"
            >
              <Icon name="arrow" size={16} className="rotate-180 rtl:rotate-0" />
            </button>
            <button
              type="button"
              aria-label={t('nextMonth')}
              disabled={report.isCurrentMonth}
              onClick={() => setMonth(shiftMonth(report.month, 1))}
              className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary disabled:opacity-40"
            >
              <Icon name="arrow" size={16} flipInRtl />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" key={`${calendar}-${report.month}`}>
        <Tile
          icon="reflection"
          label={t('tiles.reflections')}
          value={report.reflections.written}
          fmt={fmt}
          tone="text-primary"
        />
        <Tile
          icon="book"
          label={t('tiles.quranPages')}
          value={report.quran.pages}
          fmt={fmt}
          tone="text-accent"
        />
        <Tile
          icon="clock"
          label={t('tiles.revisedAyahs')}
          value={report.quran.revisedAyahs}
          fmt={fmt}
          tone="text-primary"
        />
        <Tile
          icon="sunnah"
          label={t('tiles.memorizedAyahs')}
          value={report.quran.memorizedAyahs}
          fmt={fmt}
          tone="text-accent"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <Icon name="worship" className="text-primary" /> {t('monthActivitiesTitle')}
            </h2>
            <p className="text-sm text-muted">{t('pickActivity')}</p>
            {report.activities.length === 0 && (
              <p className="mt-3 text-sm text-muted">{t('noActivities')}</p>
            )}
            {obligatory.length > 0 && (
              <>
                <h3 className="mt-3 text-sm font-semibold text-primary">
                  {tw('categories.obligatory_prayer')}
                </h3>
                <ul className="divide-y divide-border">
                  {obligatory.map((a) => row(a.activityId, name(a), a.logged, a.eligible, a))}
                </ul>
              </>
            )}
            {voluntary.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-accent">{tw('voluntary')}</h3>
                <ul className="divide-y divide-border">
                  {voluntary.map((a) => row(a.activityId, name(a), a.logged, a.eligible, a))}
                </ul>
              </>
            )}
            <ul className="mt-2 border-t border-border">
              {row(REFLECTION, t('reflectionRow'), report.reflections.written, reflectionEligible)}
            </ul>
          </section>
        </Reveal>

        {/* On phones the calendar comes first, so picking an activity below updates it in view. */}
        <Reveal className="order-first lg:order-none">
          <section className="rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-6">
            <h2 className="mb-4 font-display text-xl font-bold">
              {t('calendarFor', { name: selectedName })}
            </h2>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted" aria-hidden>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>{weekdayNames[(me.preferences.weekStart + i) % 7]}</span>
              ))}
            </div>
            <ol
              className="mt-1.5 grid grid-cols-7 gap-1.5"
              key={`${calendar}-${report.month}-${selected?.activityId ?? REFLECTION}`}
            >
              {Array.from({ length: lead }, (_, i) => (
                <li key={`lead-${i}`} aria-hidden />
              ))}
              {report.days.map((d, i) => {
                const state = perDay[i]!;
                const n = fmt(dayNumber(d as LocalDate));
                return (
                  <li
                    key={d}
                    className={`tk-cell flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums ${DAY_CELL[state]} ${d === report.today ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                    style={{ animationDelay: `${i * 12}ms` }}
                    aria-label={`${n}: ${tw(`legend.${state}`)}`}
                  >
                    {n}
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
              {(['logged', 'partial', 'not_logged', 'excused'] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`size-3.5 rounded ${DAY_CELL[s]}`} />
                  {tw(`legend.${s}`)}
                </span>
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      <Reveal>
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-accent">
            <Icon name="heart" /> {t('attentionTitle')}
          </h2>
          {attention.length ? (
            <>
              <p className="mb-3 text-sm text-muted">{t('monthAttentionBody')}</p>
              <div className="flex flex-wrap gap-2">
                {attention.map((a) => (
                  <span
                    key={a.activityId}
                    className="rounded-full border border-accent/40 bg-surface px-3 py-1 text-sm"
                  >
                    {name(a)} · {t('ofDays', { logged: fmt(a.logged), eligible: fmt(a.eligible) })}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm">{t('monthAttentionNone')}</p>
          )}
        </section>
      </Reveal>

      <Reveal>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Icon name="sunnah" className="text-accent" /> {t('monthGoalsTitle')}
          </h2>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted">
            <Icon name="lock" size={14} className="text-primary" />
            {t('reviewsSaved', { count: report.reviewsSaved, n: fmt(report.reviewsSaved) })}
          </p>
          {report.goals.length === 0 ? (
            <p className="text-sm text-muted">{t('goalsEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.goals.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-bg px-4 py-3"
                >
                  <span className={g.status === 'done' ? 'line-through decoration-primary/50' : ''}>
                    {g.text}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${g.status === 'done' ? 'bg-primary/10 text-primary' : g.status === 'active' ? 'bg-accent/10 text-accent' : 'bg-excused/30'}`}
                  >
                    {t(`goalStatus.${g.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      <p className="text-center text-sm text-muted">{t('footer')}</p>
    </div>
  );
}
