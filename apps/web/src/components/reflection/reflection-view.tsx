'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  ReflectionDayResponse,
  ReflectionDto,
  ReflectionQuestionDto,
} from '@tadhkirah/contracts';
import { formatHijri } from '@tadhkirah/domain';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { shift } from '@/lib/use-worship';
import { useMe } from '../me-context';
import { GeometricPattern } from '../ui/art';
import { Icon } from '../ui/icons';
import { Button } from '../ui/primitives';
import { QuestionsEditor } from './questions-editor';

type Choice = 'yes' | 'partly' | 'no' | 'prefer_not';
interface Form {
  answers: Record<string, { choice: Choice | null; text: string }>;
  gratitude: [string, string, string];
  shortcoming: string;
  repentanceNoted: boolean;
  intention: string;
  freeText: string;
}
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const CHOICES: Choice[] = ['yes', 'partly', 'no'];
const textarea =
  'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-base leading-relaxed placeholder:text-muted focus:border-primary';

function toForm(r: ReflectionDto | null, suggestions: Record<string, Choice>): Form {
  const answers: Form['answers'] = {};
  for (const [qid, choice] of Object.entries(suggestions)) answers[qid] = { choice, text: '' };
  for (const a of r?.answers ?? [])
    answers[a.questionId] = { choice: a.choice, text: a.text ?? '' };
  const g = r?.gratitude ?? [];
  return {
    answers,
    gratitude: [g[0] ?? '', g[1] ?? '', g[2] ?? ''],
    shortcoming: r?.shortcoming ?? '',
    repentanceNoted: r?.repentanceNoted ?? false,
    intention: r?.intention ?? '',
    freeText: r?.freeText ?? '',
  };
}

/** Closing screen after finishing: gentle rising stars, no score, no streak. */
function Closing({ onEdit }: { onEdit: () => void }) {
  const t = useTranslations('reflection');
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0b2a24] px-6 py-16 text-center text-[#f3e3bd]">
      <GeometricPattern
        id="closing-pattern"
        className="absolute inset-0 text-[#b08d3c]"
        opacity={0.12}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[10, 22, 35, 48, 60, 73, 85, 93].map((x, i) => (
          <span
            key={x}
            className="tk-spark absolute bottom-6 size-1.5 rounded-full bg-[#f6dfa4]"
            style={{ insetInlineStart: `${x}%`, animationDelay: `${i * 0.6}s` }}
          />
        ))}
      </div>
      <div className="relative flex flex-col items-center gap-4">
        <span
          className="tk-pop flex size-16 items-center justify-center rounded-full bg-[#f3e3bd]/15"
          style={{ opacity: 1, transform: 'none' }}
        >
          <Icon name="heart" size={32} />
        </span>
        <h2 className="tk-word font-display text-4xl font-bold text-white">{t('closingTitle')}</h2>
        <p className="tk-rise tk-rise-2 max-w-md text-lg opacity-85">{t('closingBody')}</p>
        <div className="tk-rise tk-rise-3 mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/app/today"
            className="rounded-xl bg-[#f3e3bd] px-5 py-2.5 font-semibold text-[#0b2a24]"
          >
            {t('backToToday')}
          </Link>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-[#f3e3bd]/40 px-5 py-2.5"
          >
            {t('edit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Daily reflection (Module A). Everything is optional, it autosaves a moment
 * after you stop typing (encrypted on the server), and it never scores anything.
 */
export function ReflectionView() {
  const t = useTranslations('reflection');
  const tq = useTranslations('reflection.questions');
  const tc = useTranslations('reflection.choices');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ReflectionDayResponse | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const version = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = useRef<string | null>(null);

  const date = today.current ? shift(today.current, offset) : null;

  const load = useCallback(async (d: string | null) => {
    const target = d ?? 'today';
    // First load: learn "today" from the server (tracking day starts at Fajr).
    const probe =
      d ?? (await api<{ today: string }>(`/worship/logs?from=2000-01-01&to=2000-01-01`)).today;
    if (!d) today.current = probe;
    const res = await api<ReflectionDayResponse>(
      `/reflections/${target === 'today' ? probe : target}`,
    );
    setData(res);
    setForm(toForm(res.reflection, res.suggestions));
    version.current = res.reflection?.version;
    setState('idle');
  }, []);

  useEffect(() => {
    void load(date);
  }, [offset]);

  const save = useCallback(
    async (f: Form, complete = false) => {
      if (!date) return;
      setState('saving');
      try {
        const res = await api<ReflectionDto>(`/reflections/${date}`, {
          method: 'PUT',
          body: {
            version: version.current,
            answers: Object.entries(f.answers).map(([questionId, a]) => ({
              questionId,
              choice: a.choice,
              text: a.text.trim() || null,
            })),
            gratitude: f.gratitude.filter((g) => g.trim()),
            shortcoming: f.shortcoming.trim() || null,
            repentanceNoted: f.repentanceNoted,
            intention: f.intention.trim() || null,
            freeText: f.freeText.trim() || null,
            complete,
          },
        });
        version.current = res.version;
        setData((d) => (d ? { ...d, reflection: res } : d));
        setState('saved');
        if (complete) setClosing(true);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'reflection.version_conflict') {
          setState('conflict');
          await load(date);
          setState('conflict');
        } else setState('error');
      }
    },
    [date, load],
  );

  /** Update the form and autosave 1.2 s after the last change. */
  const update = (patch: Partial<Form> | ((f: Form) => Form)) => {
    setForm((f) => {
      if (!f) return f;
      const next = typeof patch === 'function' ? patch(f) : { ...f, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(next), 1200);
      return next;
    });
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!data || !form || !date) {
    return (
      <div
        className="h-[32rem] animate-pulse rounded-2xl border border-border bg-surface"
        aria-busy
      />
    );
  }

  const completed = Boolean(data.reflection?.completedAt);
  if (closing) return <Closing onEdit={() => setClosing(false)} />;

  const dateLabel = `${new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(
    new Date(`${date}T12:00:00Z`),
  )} · ${formatHijri(date, locale, { offsetDays: me.preferences.hijriOffset, digits: me.profile.digits })}`;

  const qText = (q: ReflectionQuestionDto) =>
    q.catalogKey ? tq(q.catalogKey as 'tongue') : (q.text ?? '');
  const questions = data.questions.filter((q) => q.enabled);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon name="reflection" size={24} />
            </span>
            {t('title')}
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('prevDay')}
              disabled={offset <= -data.backfillDays}
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
        <p className="text-muted">{dateLabel}</p>
        <p className="flex items-center gap-2 text-sm text-primary">
          <Icon name="lock" size={16} /> {t('private')}
        </p>
        <p className="leading-relaxed text-muted">{t('intro')}</p>
      </header>

      {completed && (
        <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
          <Icon name="check" size={16} /> {t('completed')}
        </p>
      )}

      {/* Questions */}
      <section className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const a = form.answers[q.id] ?? { choice: null, text: '' };
          const suggested = data.suggestions[q.id];
          const fromLog =
            suggested &&
            a.choice === suggested &&
            !data.reflection?.answers.some((x) => x.questionId === q.id);
          return (
            <div
              key={q.id}
              className="tk-cell rounded-2xl border border-border bg-surface p-5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <p className="mb-3 text-lg font-medium leading-relaxed">{qText(q)}</p>
              {q.answerType !== 'text' && (
                <div
                  role="group"
                  aria-label={qText(q)}
                  className="flex flex-wrap items-center gap-2"
                >
                  {CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={a.choice === c}
                      onClick={() =>
                        update((f) => ({
                          ...f,
                          answers: {
                            ...f.answers,
                            [q.id]: { ...a, choice: a.choice === c ? null : c },
                          },
                        }))
                      }
                      className="min-h-10 rounded-full border border-border px-4 text-sm transition-all active:scale-95 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
                    >
                      {tc(c)}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={a.choice === 'prefer_not'}
                    onClick={() =>
                      update((f) => ({
                        ...f,
                        answers: {
                          ...f.answers,
                          [q.id]: { ...a, choice: a.choice === 'prefer_not' ? null : 'prefer_not' },
                        },
                      }))
                    }
                    className="min-h-10 rounded-full px-3 text-sm text-muted aria-pressed:bg-excused/30 aria-pressed:text-text"
                  >
                    {tc('prefer_not')}
                  </button>
                  {fromLog && (
                    <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                      <Icon name="worship" size={12} /> {t('fromLog')}
                    </span>
                  )}
                </div>
              )}
              {q.answerType !== 'yes_partly_no' && (
                <textarea
                  rows={q.answerType === 'text' ? 3 : 2}
                  className={`${textarea} ${q.answerType === 'both' ? 'mt-3' : ''}`}
                  placeholder={
                    q.answerType === 'text' ? t('answerPlaceholder') : t('notePlaceholder')
                  }
                  value={a.text}
                  maxLength={2000}
                  onChange={(e) =>
                    update((f) => ({
                      ...f,
                      answers: { ...f.answers, [q.id]: { ...a, text: e.target.value } },
                    }))
                  }
                />
              )}
            </div>
          );
        })}
      </section>

      {/* Gratitude */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Icon name="heart" className="text-accent" /> {t('gratitude')}
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {form.gratitude.map((g, i) => (
            <input
              key={i}
              className={textarea}
              maxLength={300}
              placeholder={t('gratitudePlaceholder', {
                n: new Intl.NumberFormat(`${locale}-u-nu-${me.profile.digits}`).format(i + 1),
              })}
              value={g}
              onChange={(e) =>
                update((f) => {
                  const gratitude = [...f.gratitude] as Form['gratitude'];
                  gratitude[i] = e.target.value;
                  return { ...f, gratitude };
                })
              }
            />
          ))}
        </div>
      </section>

      {/* Returning */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Icon name="today" className="text-primary" /> {t('shortcoming')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('shortcomingHint')}</p>
        <textarea
          rows={3}
          className={textarea}
          maxLength={2000}
          value={form.shortcoming}
          onChange={(e) => update({ shortcoming: e.target.value })}
        />
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/10">
          <input
            type="checkbox"
            className="accent-[var(--primary)]"
            checked={form.repentanceNoted}
            onChange={(e) => update({ repentanceNoted: e.target.checked })}
          />
          {t('repentance')}
        </label>
      </section>

      {/* Intention + free text */}
      <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-primary">
          <Icon name="sunnah" /> {t('intention')}
        </h2>
        <input
          className={textarea}
          maxLength={300}
          placeholder={t('intentionPlaceholder')}
          value={form.intention}
          onChange={(e) => update({ intention: e.target.value })}
        />
        <h3 className="mt-5 mb-2 text-sm font-medium text-muted">{t('freeText')}</h3>
        <textarea
          rows={4}
          className={textarea}
          maxLength={5000}
          value={form.freeText}
          onChange={(e) => update({ freeText: e.target.value })}
        />
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <span
          className="flex items-center gap-2 px-2 text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          {state === 'saving' && t('saving')}
          {state === 'saved' && (
            <>
              <Icon name="lock" size={14} className="text-primary" /> {t('saved')}
            </>
          )}
          {state === 'error' && <span className="text-danger">{t('saveError')}</span>}
          {state === 'conflict' && <span className="text-accent">{t('conflict')}</span>}
        </span>
        <Button
          type="button"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            void save(form, true);
          }}
          disabled={state === 'saving'}
        >
          <Icon name="check" size={16} /> {t('finish')}
        </Button>
      </div>

      <details
        open={editing}
        onToggle={(e) => setEditing((e.target as HTMLDetailsElement).open)}
        className="rounded-2xl border border-border bg-surface p-5"
      >
        <summary className="cursor-pointer font-medium">{t('customize')}</summary>
        {editing && (
          <QuestionsEditor
            questions={data.questions}
            onChange={(questions) => setData({ ...data, questions })}
          />
        )}
      </details>
    </div>
  );
}
