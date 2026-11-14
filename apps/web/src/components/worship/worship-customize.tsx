'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, errorKey } from '@/lib/api';
import { useWorship } from '@/lib/use-worship';
import type { ActivityDto, ScheduleDto } from '@/lib/worship-types';
import { Icon } from '../ui/icons';
import { Button, Field, Input, Select, Status } from '../ui/primitives';
import { useActivityName } from './names';

const ORDER = [
  'obligatory_prayer',
  'voluntary_prayer',
  'adhkar',
  'quran',
  'fasting',
  'custom',
] as const;

function ScheduleEditor({
  value,
  onChange,
  disabled,
}: {
  value: ScheduleDto;
  onChange: (s: ScheduleDto) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('worship');
  const locale = useLocale();
  const names = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 10, 15 + i))));
  }, [locale]);
  return (
    <div className="flex flex-col gap-2">
      <Select
        aria-label={t('schedule')}
        disabled={disabled}
        value={value.type}
        onChange={(e) => {
          const type = e.target.value as ScheduleDto['type'];
          onChange(
            type === 'daily'
              ? { type }
              : type === 'weekdays'
                ? { type, days: [1, 4] }
                : { type, n: 3 },
          );
        }}
      >
        <option value="daily">{t('scheduleDaily')}</option>
        <option value="weekdays">{t('scheduleWeekdays')}</option>
        <option value="times_per_week">{t('scheduleTimes')}</option>
      </Select>
      {value.type === 'weekdays' && (
        <div className="flex flex-wrap gap-1.5">
          {[6, 0, 1, 2, 3, 4, 5].map((d) => {
            const on = value.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const days = on ? value.days.filter((x) => x !== d) : [...value.days, d].sort();
                  if (days.length) onChange({ type: 'weekdays', days });
                }}
                className="rounded-full border border-border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
              >
                {names[d]}
              </button>
            );
          })}
        </div>
      )}
      {value.type === 'times_per_week' && (
        <label className="flex items-center gap-2 text-sm">
          <Input
            type="number"
            dir="ltr"
            min={1}
            max={7}
            className="max-w-20"
            value={value.n}
            onChange={(e) =>
              onChange({
                type: 'times_per_week',
                n: Math.max(1, Math.min(7, Number(e.target.value) || 1)),
              })
            }
          />
          {t('timesPerWeek')}
        </label>
      )}
    </div>
  );
}

/** Customize: enable, reorder, schedule, goals, and your own activities. */
export function WorshipCustomize() {
  const t = useTranslations('worship');
  const tc = useTranslations('worship.categories');
  const te = useTranslations('errors');
  const name = useActivityName();
  const w = useWorship(null, null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function patch(a: ActivityDto, body: Partial<ActivityDto>) {
    const before = w.activities;
    w.setActivities((list) => list.map((x) => (x.id === a.id ? { ...x, ...body } : x)));
    try {
      await api(`/worship/activities/${a.id}`, { method: 'PATCH', body });
      setError(null);
    } catch (err) {
      w.setActivities(() => before);
      setError(te(errorKey(err)));
    }
  }

  async function move(a: ActivityDto, dir: -1 | 1) {
    const list = [...w.activities];
    const i = list.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    w.setActivities(() => list);
    await api('/worship/activities/order', {
      method: 'PUT',
      body: { ids: list.map((x) => x.id) },
    }).catch(() => setError(te('generic')));
  }

  async function remove(a: ActivityDto) {
    w.setActivities((list) => list.filter((x) => x.id !== a.id));
    await api(`/worship/activities/${a.id}`, { method: 'DELETE' }).catch(() =>
      setError(te('generic')),
    );
  }

  if (w.loading)
    return (
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" aria-busy />
    );

  return (
    <div className="flex flex-col gap-5">
      {ORDER.map((cat) => {
        const items = w.activities.filter((a) => a.category === cat);
        if (!items.length && cat !== 'custom') return null;
        const obligatory = cat === 'obligatory_prayer';
        return (
          <section key={cat} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">
              {tc(cat)}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${obligatory ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}
              >
                {obligatory ? t('obligatory') : t('voluntary')}
              </span>
            </h2>
            <p className="mb-3 text-sm text-muted">
              {obligatory ? t('obligatoryNote') : t('voluntaryNote')}
            </p>
            {!items.length && <p className="text-sm text-muted">{t('empty')}</p>}
            <ul className="divide-y divide-border">
              {items.map((a) => {
                const expanded = open === a.id;
                return (
                  <li key={a.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <label className="flex flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          role="switch"
                          className="size-5 accent-[var(--primary)]"
                          checked={a.enabled}
                          onChange={(e) => patch(a, { enabled: e.target.checked })}
                          aria-label={`${t('enabled')}: ${name(a)}`}
                        />
                        <span className={a.enabled ? 'font-medium' : 'text-muted'}>{name(a)}</span>
                      </label>
                      <button
                        type="button"
                        aria-label={t('moveUp')}
                        onClick={() => move(a, -1)}
                        className="rounded p-1 text-muted hover:text-primary"
                      >
                        <Icon name="arrow" size={16} className="-rotate-90" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('moveDown')}
                        onClick={() => move(a, 1)}
                        className="rounded p-1 text-muted hover:text-primary"
                      >
                        <Icon name="arrow" size={16} className="rotate-90" />
                      </button>
                      {!obligatory && (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={t('schedule')}
                          onClick={() => setOpen(expanded ? null : a.id)}
                          className="rounded p-1 text-muted hover:text-primary aria-expanded:text-primary"
                        >
                          <Icon name="settings" size={18} />
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="mt-3 grid gap-4 rounded-xl bg-bg p-4 sm:grid-cols-2">
                        {a.category === 'custom' && (
                          <Field label={t('rename')} htmlFor={`name-${a.id}`}>
                            <Input
                              id={`name-${a.id}`}
                              defaultValue={a.name ?? ''}
                              maxLength={60}
                              onBlur={(e) =>
                                e.target.value.trim() &&
                                e.target.value !== a.name &&
                                patch(a, { name: e.target.value.trim() })
                              }
                            />
                          </Field>
                        )}
                        <Field label={t('schedule')} htmlFor={`sched-${a.id}`}>
                          <ScheduleEditor
                            value={a.schedule}
                            onChange={(s) => patch(a, { schedule: s })}
                          />
                        </Field>
                        {a.measure === 'count' && (
                          <Field label={t('target')} htmlFor={`target-${a.id}`}>
                            <Input
                              id={`target-${a.id}`}
                              type="number"
                              dir="ltr"
                              min={1}
                              max={a.max ?? 10_000}
                              defaultValue={a.dailyTarget ?? ''}
                              onBlur={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                if (v !== a.dailyTarget)
                                  patch(a, { dailyTarget: v && v > 0 ? v : null });
                              }}
                            />
                          </Field>
                        )}
                        {a.category === 'custom' && (
                          <div className="flex items-end">
                            <Button variant="ghost" type="button" onClick={() => remove(a)}>
                              {t('remove')}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {cat === 'custom' && <AddCustom onAdded={(a) => w.setActivities((l) => [...l, a])} />}
          </section>
        );
      })}
      {error && <Status tone="error">{error}</Status>}
    </div>
  );
}

function AddCustom({ onAdded }: { onAdded: (a: ActivityDto) => void }) {
  const t = useTranslations('worship');
  const te = useTranslations('errors');
  const [form, setForm] = useState({
    name: '',
    measure: 'boolean' as 'boolean' | 'count',
    unit: 'times',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const a = await api<ActivityDto>('/worship/activities', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          measure: form.measure,
          unit: form.measure === 'count' ? form.unit : null,
        },
      });
      onAdded(a);
      setForm({ ...form, name: '' });
      setError(null);
    } catch (err) {
      setError(te(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
    >
      <Field label={t('customName')} htmlFor="custom-name">
        <Input
          id="custom-name"
          maxLength={60}
          placeholder={t('customNamePlaceholder')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label={t('measure')} htmlFor="custom-measure">
        <Select
          id="custom-measure"
          value={form.measure}
          onChange={(e) => setForm({ ...form, measure: e.target.value as 'boolean' | 'count' })}
        >
          <option value="boolean">{t('measureBoolean')}</option>
          <option value="count">{t('measureCount')}</option>
        </Select>
      </Field>
      <Field label={t('unit')} htmlFor="custom-unit">
        <Select
          id="custom-unit"
          disabled={form.measure !== 'count'}
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        >
          {(['times', 'pages', 'rakah'] as const).map((u) => (
            <option key={u} value={u}>
              {t(`units.${u}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={busy || !form.name.trim()}>
        <Icon name="check" size={16} /> {t('add')}
      </Button>
      {error && (
        <div className="sm:col-span-4">
          <Status tone="error">{error}</Status>
        </div>
      )}
    </form>
  );
}
