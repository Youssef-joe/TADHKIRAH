'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { MemorizationDto, QuranSummary, RecitationDto } from '@tadhkirah/contracts';
import { countAyahs, juzOf, searchSurahs, surah, SURAHS, type AyahRange } from '@tadhkirah/domain';
import { api, errorKey } from '@/lib/api';
import { shift } from '@/lib/use-worship';
import { useMe } from '../me-context';
import { Icon } from '../ui/icons';
import { Button, Field, Input, Select, Status } from '../ui/primitives';
import { numberFormatter } from '../worship/names';

type Fmt = (n: number) => string;

function useSurahName() {
  const locale = useLocale();
  return (n: number) => (locale === 'ar' ? surah(n).ar : surah(n).en);
}

/** Animated progress ring: memorized ayahs out of 6,236. */
function ProgressRing({ value, total, percent }: { value: number; total: number; percent: Fmt }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <svg viewBox="0 0 120 120" className="size-32 shrink-0 -rotate-90" aria-hidden>
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - shown)}
        style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(.3,.8,.3,1)' }}
      />
      <text
        x="60"
        y="66"
        textAnchor="middle"
        className="rotate-90 fill-text text-[20px] font-semibold"
        style={{ transformOrigin: '60px 60px' }}
      >
        {percent(pct)}
      </text>
    </svg>
  );
}

function SurahSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const name = useSurahName();
  const locale = useLocale();
  const fmt = numberFormatter(locale, 'latn');
  return (
    <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {SURAHS.map((s) => (
        <option key={s.n} value={s.n}>
          {fmt(s.n)}. {name(s.n)}
        </option>
      ))}
    </Select>
  );
}

/** Log recitation: pages, or a surah:ayah range, for today or a recent day. */
function RecitationForm({
  today,
  backfillDays,
  onSaved,
}: {
  today: string;
  backfillDays: number;
  onSaved: () => void;
}) {
  const t = useTranslations('quran');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { me } = useMe();
  const [mode, setMode] = useState<'pages' | 'range'>('pages');
  const [date, setDate] = useState(today);
  const [pages, setPages] = useState('');
  const [from, setFrom] = useState({ surah: 1, ayah: 1 });
  const [to, setTo] = useState({ surah: 1, ayah: 7 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Array.from({ length: backfillDays + 1 }, (_, i) => shift(today, -i));
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${d}T12:00:00Z`));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/quran/recitations', {
        method: 'POST',
        body: {
          id: crypto.randomUUID(),
          localDate: date,
          pages: mode === 'pages' ? Number(pages) : null,
          from: mode === 'range' ? from : null,
          to: mode === 'range' ? to : null,
        },
      });
      setPages('');
      onSaved();
    } catch (err) {
      setError(te(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  const clampAyah = (s: number, a: number) => Math.max(1, Math.min(surah(s).ayahs, a || 1));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 self-start rounded-full border border-border p-1">
        {(['pages', 'range'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="rounded-full px-3 py-1 text-sm text-muted aria-selected:bg-primary aria-selected:text-white"
          >
            {m === 'pages' ? t('byPages') : t('byRange')}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label={t('day')} htmlFor="rec-day">
          <Select id="rec-day" value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </Select>
        </Field>
        {mode === 'pages' ? (
          <Field label={t('pages')} htmlFor="rec-pages">
            <Input
              id="rec-pages"
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0.5}
              max={604}
              step={0.5}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
            />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['from', from, setFrom],
                ['to', to, setTo],
              ] as const
            ).map(([k, v, set]) => (
              <fieldset key={k} className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">{t(k)}</legend>
                <SurahSelect
                  id={`rec-${k}-surah`}
                  value={v.surah}
                  onChange={(s) => set({ surah: s, ayah: k === 'to' ? surah(s).ayahs : 1 })}
                />
                <Input
                  aria-label={`${t(k)} · ${t('ayah')}`}
                  type="number"
                  dir="ltr"
                  min={1}
                  max={surah(v.surah).ayahs}
                  value={v.ayah}
                  onChange={(e) => set({ ...v, ayah: clampAyah(v.surah, Number(e.target.value)) })}
                />
              </fieldset>
            ))}
          </div>
        )}
      </div>
      {error && <Status tone="error">{error}</Status>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">{t('syncNote')}</p>
        <Button type="submit" disabled={busy || (mode === 'pages' && !(Number(pages) > 0))}>
          {busy ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

function RecitationLine({
  r,
  fmt,
  onDelete,
}: {
  r: RecitationDto;
  fmt: Fmt;
  onDelete: () => void;
}) {
  const t = useTranslations('quran');
  const name = useSurahName();
  const locale = useLocale();
  const { me } = useMe();
  const day = new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
  }).format(new Date(`${r.localDate}T12:00:00Z`));
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="w-16 shrink-0 text-muted">{day}</span>
      <span className="flex flex-1 flex-wrap items-center gap-2">
        {r.pages != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {t('pagesShort', { n: fmt(r.pages) })}
          </span>
        )}
        {r.from && r.to && (
          <bdi>
            {name(r.from.surah)} {fmt(r.from.ayah)} –{' '}
            {r.from.surah !== r.to.surah ? `${name(r.to.surah)} ` : ''}
            {fmt(r.to.ayah)}
          </bdi>
        )}
      </span>
      <button type="button" onClick={onDelete} className="text-xs text-muted hover:text-primary">
        {t('delete')}
      </button>
    </li>
  );
}

/** Inline revision logger for one surah (range defaults to the memorized part). */
function RevisionForm({
  memo,
  today,
  onSaved,
}: {
  memo: MemorizationDto;
  today: string;
  onSaved: () => void;
}) {
  const t = useTranslations('quran');
  const te = useTranslations('errors');
  const total = surah(memo.surah).ayahs;
  const first = memo.ranges[0] ?? [1, total];
  const last = memo.ranges[memo.ranges.length - 1] ?? [1, total];
  const [from, setFrom] = useState(first[0]);
  const [to, setTo] = useState(last[1]);
  const [quality, setQuality] = useState<'smooth' | 'some_mistakes' | 'needs_work' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await api('/quran/revisions', {
        method: 'POST',
        body: {
          id: crypto.randomUUID(),
          localDate: today,
          surah: memo.surah,
          fromAyah: from,
          toAyah: to,
          quality,
        },
      });
      onSaved();
    } catch (err) {
      setError(te(errorKey(err)));
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-bg p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{t('from')}</span>
        <Input
          type="number"
          dir="ltr"
          className="max-w-20"
          min={1}
          max={total}
          value={from}
          onChange={(e) => setFrom(Math.max(1, Math.min(total, Number(e.target.value) || 1)))}
          aria-label={t('from')}
        />
        <span>{t('to')}</span>
        <Input
          type="number"
          dir="ltr"
          className="max-w-20"
          min={1}
          max={total}
          value={to}
          onChange={(e) => setTo(Math.max(1, Math.min(total, Number(e.target.value) || 1)))}
          aria-label={t('to')}
        />
      </div>
      <div role="group" aria-label={t('quality')} className="flex flex-wrap items-center gap-1.5">
        <span className="me-1 text-sm text-muted">{t('quality')}</span>
        {(['smooth', 'some_mistakes', 'needs_work'] as const).map((q) => (
          <button
            key={q}
            type="button"
            aria-pressed={quality === q}
            onClick={() => setQuality(quality === q ? null : q)}
            className="rounded-full border border-border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
          >
            {t(`qualities.${q}`)}
          </button>
        ))}
      </div>
      {error && <Status tone="error">{error}</Status>}
      <Button type="button" className="self-end" onClick={save} disabled={from > to}>
        <Icon name="check" size={16} /> {t('save')}
      </Button>
    </div>
  );
}

/** Editor for one surah's memorization status and ranges. */
function MemoEditor({
  n,
  memo,
  onSaved,
  onClose,
  fmt,
}: {
  n: number;
  memo?: MemorizationDto;
  onSaved: (m: MemorizationDto) => void;
  onClose: () => void;
  fmt: Fmt;
}) {
  const t = useTranslations('quran');
  const te = useTranslations('errors');
  const name = useSurahName();
  const total = surah(n).ayahs;
  const [ranges, setRanges] = useState<AyahRange[]>(memo?.ranges.length ? memo.ranges : []);
  const [error, setError] = useState<string | null>(null);

  async function save(status: MemorizationDto['status'], r: AyahRange[]) {
    try {
      const m = await api<MemorizationDto>(`/quran/memorization/${n}`, {
        method: 'PUT',
        body: { status, ranges: r },
      });
      setRanges(m.ranges);
      onSaved(m);
    } catch (err) {
      setError(te(errorKey(err)));
    }
  }

  return (
    <div
      className="rounded-2xl border border-primary/40 bg-surface p-5 shadow-lg"
      role="dialog"
      aria-label={name(n)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-primary">{name(n)}</h3>
          <p className="text-sm text-muted">
            {t('ayahCount', { n: fmt(total) })} · {t('juz', { n: fmt(juzOf(n)) })}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-primary">
          {t('close')}
        </button>
      </div>
      <div role="group" className="mb-4 flex flex-wrap gap-1.5">
        {(['not_started', 'in_progress', 'memorized'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={(memo?.status ?? 'not_started') === s}
            onClick={() =>
              save(s, s === 'not_started' ? [] : s === 'memorized' ? [[1, total]] : ranges)
            }
            className="rounded-full border border-border px-3 py-1.5 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
          >
            {t(`statuses.${s}`)}
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm font-medium">{t('ranges')}</p>
      <ul className="mb-3 flex flex-col gap-2">
        {ranges.map(([a, b], i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <Input
              type="number"
              dir="ltr"
              className="max-w-20"
              min={1}
              max={total}
              value={a}
              aria-label={t('from')}
              onChange={(e) =>
                setRanges(
                  ranges.map((r, j) =>
                    j === i ? [Math.max(1, Math.min(total, Number(e.target.value) || 1)), r[1]] : r,
                  ),
                )
              }
            />
            <span>–</span>
            <Input
              type="number"
              dir="ltr"
              className="max-w-20"
              min={1}
              max={total}
              value={b}
              aria-label={t('to')}
              onChange={(e) =>
                setRanges(
                  ranges.map((r, j) =>
                    j === i ? [r[0], Math.max(1, Math.min(total, Number(e.target.value) || 1))] : r,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-xs text-muted hover:text-primary"
              onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
            >
              {t('delete')}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            const start = (ranges.at(-1)?.[1] ?? 0) + 1;
            if (start <= total) setRanges([...ranges, [start, total]]);
          }}
        >
          {t('addRange')}
        </Button>
        <Button variant="ghost" type="button" onClick={() => save('memorized', [[1, total]])}>
          {t('wholeSurah')}
        </Button>
        <Button
          type="button"
          onClick={() => save(ranges.length ? 'in_progress' : 'not_started', ranges)}
        >
          {t('save')}
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <Status tone="error">{error}</Status>
        </div>
      )}
    </div>
  );
}

/** Quran progress (M4): recitation, revision suggestions and the memorization map. */
export function QuranPanel() {
  const t = useTranslations('quran');
  const locale = useLocale();
  const { me } = useMe();
  const fmt = numberFormatter(locale, me.profile.digits);
  const name = useSurahName();
  const [data, setData] = useState<QuranSummary | null>(null);
  const [query, setQuery] = useState('');
  const [fromEnd, setFromEnd] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [revising, setRevising] = useState<number | null>(null);

  const load = useCallback(async () => {
    setData(await api<QuranSummary>('/quran/summary'));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const memoBy = useMemo(() => new Map(data?.memorization.map((m) => [m.surah, m]) ?? []), [data]);
  const list = useMemo(() => {
    const found = searchSurahs(query);
    return fromEnd ? [...found].reverse() : found;
  }, [query, fromEnd]);

  if (!data)
    return (
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" aria-busy />
    );

  const dateLabel = (d: string) =>
    new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${d}T12:00:00Z`));

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-6">
          <ProgressRing
            value={data.memorizedAyahs}
            total={data.totalAyahs}
            percent={(p) =>
              new Intl.NumberFormat(`${locale}-u-nu-${me.profile.digits}`, {
                style: 'percent',
                maximumFractionDigits: 1,
              }).format(p)
            }
          />
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl font-bold">{t('progressTitle')}</h2>
            <p className="text-muted">
              {t('memorizedAyahs', {
                memorized: fmt(data.memorizedAyahs),
                total: fmt(data.totalAyahs),
              })}
            </p>
            <div className="flex gap-4 text-sm">
              <span>
                <b className="text-lg text-primary">{fmt(data.memorizedSurahs)}</b>{' '}
                {t('memorizedSurahs')}
              </span>
              <span>
                <b className="text-lg text-accent">{fmt(data.inProgressSurahs)}</b>{' '}
                {t('inProgressSurahs')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Recitation */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Icon name="book" className="text-primary" /> {t('logTitle')}
        </h2>
        <RecitationForm today={data.today} backfillDays={data.backfillDays} onSaved={load} />
        <h3 className="mt-5 mb-1 text-sm font-medium text-muted">{t('recent')}</h3>
        {data.recentRecitations.length === 0 ? (
          <p className="text-sm text-muted">{t('nothingYet')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentRecitations.map((r) => (
              <RecitationLine
                key={r.id}
                r={r}
                fmt={fmt}
                onDelete={() => api(`/quran/recitations/${r.id}`, { method: 'DELETE' }).then(load)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Revision suggestions */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Icon name="clock" className="text-accent" /> {t('revisionTitle')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('revisionHint')}</p>
        {data.revisionDue.length === 0 ? (
          <p className="text-sm">{t('noRevision')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.revisionDue.map((d) => (
              <li key={d.surah} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{name(d.surah)}</p>
                    <p className="text-xs text-muted">
                      {d.lastRevisedOn
                        ? t('lastRevised', { date: dateLabel(d.lastRevisedOn) })
                        : t('neverRevised')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setRevising(revising === d.surah ? null : d.surah)}
                  >
                    {t('logRevision')}
                  </Button>
                </div>
                {revising === d.surah && memoBy.get(d.surah) && (
                  <RevisionForm
                    memo={memoBy.get(d.surah)!}
                    today={data.today}
                    onSaved={() => {
                      setRevising(null);
                      void load();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Memorization map */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="sunnah" className="text-primary" /> {t('mapTitle')}
          </h2>
          <div className="flex gap-1 rounded-full border border-border p-1 text-sm">
            {[false, true].map((end) => (
              <button
                key={String(end)}
                type="button"
                aria-pressed={fromEnd === end}
                onClick={() => setFromEnd(end)}
                className="rounded-full px-3 py-1 text-muted aria-pressed:bg-primary aria-pressed:text-white"
              >
                {end ? t('orderFromEnd') : t('orderFromStart')}
              </button>
            ))}
          </div>
        </div>
        <Input
          type="search"
          placeholder={t('search')}
          aria-label={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-4"
        />
        {editing && (
          <div className="mb-4">
            <MemoEditor
              key={editing}
              n={editing}
              memo={memoBy.get(editing)}
              fmt={fmt}
              onClose={() => setEditing(null)}
              onSaved={() => void load()}
            />
          </div>
        )}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((s, i) => {
            const m = memoBy.get(s.n);
            const pct = m ? countAyahs(m.ranges) / s.ayahs : 0;
            const status = m?.status ?? 'not_started';
            return (
              <li
                key={s.n}
                className="tk-cell"
                style={{ animationDelay: `${Math.min(i, 40) * 10}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setEditing(s.n)}
                  aria-label={`${name(s.n)} · ${t(`statuses.${status}`)}`}
                  className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-start transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    status === 'memorized'
                      ? 'border-primary bg-primary text-white'
                      : status === 'in_progress'
                        ? 'border-primary/50 bg-bg'
                        : 'border-border bg-bg'
                  } ${editing === s.n ? 'ring-2 ring-accent' : ''}`}
                >
                  {status === 'in_progress' && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 start-0 bg-primary/15 transition-[width] duration-700"
                      style={{ width: `${pct * 100}%` }}
                    />
                  )}
                  <span className="relative flex items-baseline justify-between gap-2">
                    <span className="font-medium">{name(s.n)}</span>
                    <span
                      className={`text-xs tabular-nums ${status === 'memorized' ? 'text-white/80' : 'text-muted'}`}
                    >
                      {fmt(s.n)}
                    </span>
                  </span>
                  <span
                    className={`relative text-xs ${status === 'memorized' ? 'text-white/80' : 'text-muted'}`}
                  >
                    {t('ayahCount', { n: fmt(s.ayahs) })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
