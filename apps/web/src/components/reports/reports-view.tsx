'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ActivityReport, GoalDto, WeeklyReport, WeeklyReviewDto } from '@tadhkirah/contracts';
import { formatHijri, type LocalDate } from '@tadhkirah/domain';
import { api, errorKey } from '@/lib/api';
import { shift } from '@/lib/use-worship';
import { useMe } from '../me-context';
import { Icon, type IconName } from '../ui/icons';
import { Button, Input, Status } from '../ui/primitives';
import { Reveal } from '../ui/reveal';
import { numberFormatter, useActivityName } from '../worship/names';

type Fmt = (n: number) => string;

const CELL: Record<ActivityReport['perDay'][number], string> = {
  logged: 'bg-primary',
  partial: 'bg-primary/40',
  not_logged: 'border border-border',
  excused: 'bg-excused/50',
  not_scheduled: 'bg-transparent',
  future: 'border border-dashed border-border/60',
};

/** Counts up from 0 once on mount (instant under reduced motion). */
function CountUp({ value, fmt }: { value: number; fmt: Fmt }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 900);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10)}</>;
}

function Tile({
  icon,
  label,
  value,
  fmt,
  tone,
}: {
  icon: IconName;
  label: string;
  value: number;
  fmt: Fmt;
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4">
      <Icon name={icon} className={tone} />
      <p className="text-3xl font-semibold tabular-nums">
        <CountUp value={value} fmt={fmt} />
      </p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function Strip({ days, labels }: { days: ActivityReport['perDay']; labels: string[] }) {
  const tl = useTranslations('worship.legend');
  return (
    <div className="flex gap-1" aria-hidden>
      {days.map((d, i) => (
        <span
          key={i}
          title={`${labels[i]}: ${tl(d)}`}
          className={`tk-cell size-4 rounded ${CELL[d]}`}
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

function Review({ weekStart, onSaved }: { weekStart: string; onSaved: () => void }) {
  const t = useTranslations('reports');
  const te = useTranslations('errors');
  const [form, setForm] = useState<WeeklyReviewDto | null>(null);
  const [makeGoal, setMakeGoal] = useState(true);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(null);
    setState('idle');
    api<WeeklyReviewDto>(`/weekly-reviews/${weekStart}`)
      .then(setForm)
      .catch(() => undefined);
  }, [weekStart]);

  if (!form)
    return <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />;

  async function save(e: FormEvent) {
    e.preventDefault();
    setState('saving');
    try {
      const r = await api<WeeklyReviewDto>(`/weekly-reviews/${weekStart}`, {
        method: 'PUT',
        body: {
          improved: form!.improved?.trim() || null,
          neglected: form!.neglected?.trim() || null,
          madeEasier: form!.madeEasier?.trim() || null,
          changeNext: form!.changeNext?.trim() || null,
          makeGoal: makeGoal && Boolean(form!.changeNext?.trim()),
        },
      });
      setForm(r);
      setState('saved');
      onSaved();
    } catch (err) {
      setError(te(errorKey(err)));
      setState('error');
    }
  }

  const keys = ['improved', 'neglected', 'madeEasier', 'changeNext'] as const;
  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
        <Icon name="reflection" /> {t('reviewTitle')}
      </h2>
      {keys.map((k) => (
        <label key={k} className="flex flex-col gap-1.5">
          <span className="font-medium">{t(`prompts.${k}`)}</span>
          <textarea
            rows={2}
            maxLength={2000}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 leading-relaxed focus:border-primary"
            value={form[k] ?? ''}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          />
        </label>
      ))}
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-[var(--primary)]"
          checked={makeGoal}
          onChange={(e) => setMakeGoal(e.target.checked)}
        />
        {t('makeGoal')}
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-sm text-muted" role="status">
          {state === 'saving' && t('saving')}
          {state === 'saved' && (
            <>
              <Icon name="lock" size={14} className="text-primary" /> {t('saved')}
            </>
          )}
          {state === 'error' && <Status tone="error">{error}</Status>}
        </span>
        <Button type="submit" disabled={state === 'saving'}>
          {t('saveReview')}
        </Button>
      </div>
    </form>
  );
}

function Goals({ goals, onChange }: { goals: GoalDto[]; onChange: () => void }) {
  const t = useTranslations('reports');
  const te = useTranslations('errors');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = goals.filter((g) => g.status === 'active');
  const closed = goals.filter((g) => g.status !== 'active');

  const set = async (g: GoalDto, status: GoalDto['status']) => {
    await api(`/goals/${g.id}`, { method: 'PATCH', body: { status } }).catch(() =>
      setError(te('generic')),
    );
    onChange();
  };
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api('/goals', { method: 'POST', body: { text: text.trim() } });
      setText('');
      onChange();
    } catch (err) {
      setError(te(errorKey(err)));
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Icon name="sunnah" className="text-accent" /> {t('goalsTitle')}
      </h2>
      {active.length === 0 && <p className="mb-3 text-sm text-muted">{t('goalsEmpty')}</p>}
      <ul className="flex flex-col gap-2">
        {active.map((g) => (
          <li
            key={g.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg px-4 py-3"
          >
            <div>
              <p className="font-medium">{g.text}</p>
              {g.source === 'weekly_review' && (
                <p className="text-xs text-muted">{t('goalFromReview')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => set(g, 'done')}>
                <Icon name="check" size={16} /> {t('goalDone')}
              </Button>
              <Button type="button" variant="quiet" onClick={() => set(g, 'let_go')}>
                {t('goalLetGo')}
              </Button>
            </div>
          </li>
        ))}
        {closed.slice(0, 5).map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-muted"
          >
            <span className={g.status === 'done' ? 'line-through decoration-primary/50' : ''}>
              {g.text}
            </span>
            <span className="flex items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${g.status === 'done' ? 'bg-primary/10 text-primary' : 'bg-excused/30'}`}
              >
                {t(`goalStatus.${g.status}`)}
              </span>
              <button
                type="button"
                className="text-xs hover:text-primary"
                onClick={() => set(g, 'active')}
              >
                {t('goalBack')}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 flex gap-2">
        <Input
          placeholder={t('goalPlaceholder')}
          aria-label={t('addGoal')}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" className="shrink-0 whitespace-nowrap" disabled={!text.trim()}>
          {t('addGoal')}
        </Button>
      </form>
      {error && (
        <div className="mt-2">
          <Status tone="error">{error}</Status>
        </div>
      )}
    </section>
  );
}

/** Weekly report (M7): behavioural counts, gentle notes, review and goals. No scores, ever. */
export function ReportsView() {
  const t = useTranslations('reports');
  const tw = useTranslations('worship');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const fmt = numberFormatter(locale, me.profile.digits);
  const name = useActivityName();
  const [week, setWeek] = useState<string | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const current = useRef<string | null>(null);

  const load = useCallback(async (ws: string | null) => {
    const r = await api<WeeklyReport>(`/reports/weekly${ws ? `?weekStart=${ws}` : ''}`);
    if (!current.current) current.current = r.weekStart;
    setReport(r);
    setGoals(await api<GoalDto[]>('/goals'));
  }, []);
  useEffect(() => {
    void load(week);
  }, [week, load]);

  if (!report)
    return (
      <div
        className="h-[36rem] animate-pulse rounded-2xl border border-border bg-surface"
        aria-busy
      />
    );

  const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
      timeZone: 'UTC',
      ...opts,
    }).format(new Date(`${d}T12:00:00Z`));
  const range = `${dayLabel(report.weekStart, { day: 'numeric', month: 'short' })} – ${dayLabel(report.weekEnd, { day: 'numeric', month: 'short' })}`;
  const hijri = formatHijri(report.weekStart as LocalDate, locale, {
    offsetDays: me.preferences.hijriOffset,
    digits: me.profile.digits,
  });
  const weekdays = report.days.map((d) => dayLabel(d, { weekday: 'short' }));
  // At most three gentle notes, least-logged first: an invitation, not a list of shortcomings.
  const attention = report.activities
    .filter((a) => a.needsAttention)
    .sort((x, y) => x.logged / x.eligible - y.logged / y.eligible)
    .slice(0, 3);
  const obligatory = report.activities.filter((a) => a.obligation === 'obligatory');
  const voluntary = report.activities.filter((a) => a.obligation === 'voluntary');

  const row = (a: ActivityReport) => (
    <li key={a.activityId} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-32">
        <p className="font-medium">{name(a)}</p>
        {a.statusBreakdown && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
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
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Strip days={a.perDay} labels={weekdays} />
        <span className="w-16 text-end text-sm tabular-nums text-muted">
          {t('ofDays', { logged: fmt(a.logged), eligible: fmt(a.eligible) })}
        </span>
      </div>
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
            {t('weekTitle')}
          </h1>
          <p className="mt-2 text-muted">
            {report.isCurrentWeek ? `${t('thisWeek')} · ` : ''}
            {range} · {hijri}
          </p>
          <p className="text-sm text-muted">
            {t('excusedDays', { count: report.excusedDays, n: fmt(report.excusedDays) })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('prevWeek')}
            onClick={() => setWeek(shift(report.weekStart, -7))}
            className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary"
          >
            <Icon name="arrow" size={16} className="rotate-180 rtl:rotate-0" />
          </button>
          <button
            type="button"
            aria-label={t('nextWeek')}
            disabled={report.isCurrentWeek}
            onClick={() => setWeek(shift(report.weekStart, 7))}
            className="flex size-9 items-center justify-center rounded-full border border-border hover:border-primary disabled:opacity-40"
          >
            <Icon name="arrow" size={16} flipInRtl />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" key={report.weekStart}>
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

      <Reveal>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Icon name="worship" className="text-primary" /> {t('activitiesTitle')}
          </h2>
          {report.activities.length === 0 ? (
            <p className="text-sm text-muted">{t('noActivities')}</p>
          ) : (
            <>
              <h3 className="mt-3 text-sm font-semibold text-primary">
                {tw('categories.obligatory_prayer')}
              </h3>
              <ul className="divide-y divide-border">{obligatory.map(row)}</ul>
              {voluntary.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-accent">{tw('voluntary')}</h3>
                  <ul className="divide-y divide-border">{voluntary.map(row)}</ul>
                </>
              )}
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
            {(['logged', 'partial', 'not_logged', 'excused'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`size-3 rounded ${CELL[s]}`} /> {tw(`legend.${s}`)}
              </span>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-accent">
            <Icon name="heart" /> {t('attentionTitle')}
          </h2>
          {attention.length ? (
            <>
              <p className="mb-3 text-sm text-muted">{t('attentionBody')}</p>
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
            <p className="text-sm">{t('attentionNone')}</p>
          )}
        </section>
      </Reveal>

      <Reveal>
        <Review weekStart={report.weekStart} onSaved={() => void load(week)} />
      </Reveal>

      <Reveal>
        <Goals goals={goals} onChange={() => void load(week)} />
      </Reveal>

      <p className="text-center text-sm text-muted">{t('footer')}</p>
    </div>
  );
}
