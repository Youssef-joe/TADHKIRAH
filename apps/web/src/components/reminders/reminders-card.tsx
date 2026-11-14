'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { NotificationPrefsDto, ReminderRuleDto, UpcomingReminder } from '@tadhkirah/contracts';
import { api, errorKey } from '@/lib/api';
import { timeFormatter } from '@/lib/format';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { useMe } from '../me-context';
import { Button, Card, Field, Input, Select, Status } from '../ui/primitives';

type Timing = ReminderRuleDto['timing'];
type Prayer = Extract<Timing, { type: 'prayer_offset' }>['prayer'];
const PRAYERS: Prayer[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Human wording for a rule's timing: "20 minutes after Asr", "At 8:00 PM", "Every Friday · At 8:00 PM". */
function useTimingLabel() {
  const t = useTranslations('reminders');
  const tp = useTranslations('prayers');
  const locale = useLocale();
  const { me } = useMe();
  const { digits } = me.profile;
  return useCallback(
    (timing: Timing, days: number[] | null) => {
      const nf = new Intl.NumberFormat(`${locale}-u-nu-${digits}`);
      let text: string;
      if (timing.type === 'fixed') {
        const [h, m] = timing.time.split(':').map(Number);
        const time = timeFormatter(locale, digits, 'UTC').format(
          new Date(Date.UTC(2026, 0, 1, h, m)),
        );
        text = t('fixedAt', { time });
      } else {
        const prayer = tp(timing.prayer);
        const n = Math.abs(timing.offsetMin);
        const minutes = t('minutes', { n, count: nf.format(n) });
        text =
          timing.offsetMin === 0
            ? t('atPrayer', { prayer })
            : t(timing.offsetMin > 0 ? 'afterPrayer' : 'beforePrayer', { minutes, prayer });
      }
      if (days?.length === 1) {
        const day = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
          new Date(Date.UTC(2026, 10, 15 + days[0]!)), // 2026-11-15 was a Sunday
        );
        text = `${t('weekly', { day })} · ${text}`;
      }
      return text;
    },
    [t, tp, locale, digits],
  );
}

function TimingEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: Timing;
  onChange: (t: Timing) => void;
  idPrefix: string;
}) {
  const t = useTranslations('reminders');
  const tp = useTranslations('prayers');
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t('timingType')} htmlFor={`${idPrefix}-type`}>
        <Select
          id={`${idPrefix}-type`}
          value={value.type}
          onChange={(e) =>
            onChange(
              e.target.value === 'fixed'
                ? { type: 'fixed', time: '20:00' }
                : { type: 'prayer_offset', prayer: 'isha', offsetMin: 15 },
            )
          }
        >
          <option value="prayer_offset">{t('relative')}</option>
          <option value="fixed">{t('fixed')}</option>
        </Select>
      </Field>
      {value.type === 'fixed' ? (
        <Field label={t('time')} htmlFor={`${idPrefix}-time`}>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            dir="ltr"
            required
            value={value.time}
            onChange={(e) => onChange({ type: 'fixed', time: e.target.value })}
          />
        </Field>
      ) : (
        <>
          <Field label={t('prayer')} htmlFor={`${idPrefix}-prayer`}>
            <Select
              id={`${idPrefix}-prayer`}
              value={value.prayer}
              onChange={(e) => onChange({ ...value, prayer: e.target.value as Prayer })}
            >
              {PRAYERS.map((p) => (
                <option key={p} value={p}>
                  {tp(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('offset')} hint={t('offsetHint')} htmlFor={`${idPrefix}-offset`}>
            <Input
              id={`${idPrefix}-offset`}
              type="number"
              dir="ltr"
              min={-120}
              max={240}
              step={5}
              value={value.offsetMin}
              onChange={(e) =>
                onChange({
                  ...value,
                  offsetMin: Math.max(-120, Math.min(240, Number(e.target.value) || 0)),
                })
              }
            />
          </Field>
        </>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  onSaved,
  onRemove,
}: {
  rule: ReminderRuleDto;
  onSaved: (r: ReminderRuleDto) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations('reminders');
  const te = useTranslations('errors');
  const tp = useTranslations('prayers');
  const label = useTimingLabel();
  const [editing, setEditing] = useState(false);
  const [timing, setTiming] = useState<Timing>(rule.timing);
  const [allowQuiet, setAllowQuiet] = useState(rule.allowInQuietHours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    rule.category === 'custom'
      ? (rule.customTitle ?? t('cat_custom'))
      : rule.category === 'prayer' && rule.timing.type === 'prayer_offset'
        ? t('prayerRule', { prayer: tp(rule.timing.prayer) })
        : t(`cat_${rule.category}` as 'cat_quran');

  async function patch(
    body: Partial<Pick<ReminderRuleDto, 'enabled' | 'timing' | 'allowInQuietHours'>>,
  ) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api<ReminderRuleDto>(`/reminders/rules/${rule.id}`, { method: 'PATCH', body }));
      return true;
    } catch (err) {
      setError(te(errorKey(err)));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const id = `rule-${rule.id}`;
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          className="size-5 shrink-0 accent-primary"
          checked={rule.enabled}
          disabled={busy}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        <label htmlFor={id} className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-muted">{label(rule.timing, rule.days)}</span>
        </label>
        <Button variant="quiet" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? t('cancel') : t('edit')}
        </Button>
        {onRemove && (
          <Button variant="quiet" onClick={onRemove}>
            {t('remove')}
          </Button>
        )}
      </div>
      {editing && (
        <form
          className="mt-3 flex flex-col gap-3 rounded-lg bg-bg p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await patch({ timing, allowInQuietHours: allowQuiet })) setEditing(false);
          }}
        >
          <TimingEditor value={timing} onChange={setTiming} idPrefix={id} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={allowQuiet}
              onChange={(e) => setAllowQuiet(e.target.checked)}
            />
            {t('allowQuiet')}
          </label>
          <Button type="submit" className="self-start" disabled={busy}>
            {t('done')}
          </Button>
        </form>
      )}
      {error && <Status tone="error">{error}</Status>}
    </li>
  );
}

function PushRow() {
  const t = useTranslations('reminders');
  const te = useTranslations('errors');
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  async function toggle(fn: () => Promise<PushState>) {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
    } catch (err) {
      setError(te(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const message = {
    on: t('pushOn'),
    off: t('pushOff'),
    unsupported: t('pushUnsupported'),
    'ios-install': t('pushIos'),
    denied: t('pushDenied'),
    unavailable: t('pushUnavailable'),
  }[state];

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg bg-bg p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">{message}</p>
      {state === 'off' && (
        <Button className="shrink-0" disabled={busy} onClick={() => toggle(enablePush)}>
          {t('enablePush')}
        </Button>
      )}
      {state === 'on' && (
        <Button
          variant="ghost"
          className="shrink-0"
          disabled={busy}
          onClick={() => toggle(disablePush)}
        >
          {t('disablePush')}
        </Button>
      )}
      {error && <Status tone="error">{error}</Status>}
    </div>
  );
}

function PrefsForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations('reminders');
  const ts = useTranslations('settings');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { me } = useMe();
  const nf = new Intl.NumberFormat(`${locale}-u-nu-${me.profile.digits}`);
  const [form, setForm] = useState<NotificationPrefsDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api<NotificationPrefsDto>('/me/notification-preferences').then(setForm, () => undefined);
  }, []);
  if (!form) return null;
  const quiet = form.quietStart !== null && form.quietEnd !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      setForm(
        await api<NotificationPrefsDto>('/me/notification-preferences', {
          method: 'PUT',
          body: form,
        }),
      );
      setStatus({ tone: 'ok', text: ts('saved') });
      onSaved();
    } catch (err) {
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-primary"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        <span>
          <span className="block font-medium">{t('enabled')}</span>
          <span className="block text-sm text-muted">{t('enabledHint')}</span>
        </span>
      </label>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">{t('quietHours')}</legend>
        <p className="text-sm text-muted">{t('quietHint')}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={quiet}
            onChange={(e) =>
              setForm({
                ...form,
                ...(e.target.checked
                  ? { quietStart: '23:00', quietEnd: '05:00' }
                  : { quietStart: null, quietEnd: null }),
              })
            }
          />
          {t('useQuiet')}
        </label>
        {quiet && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('from')} htmlFor="quietStart">
              <Input
                id="quietStart"
                type="time"
                dir="ltr"
                required
                value={form.quietStart!}
                onChange={(e) => setForm({ ...form, quietStart: e.target.value })}
              />
            </Field>
            <Field label={t('to')} htmlFor="quietEnd">
              <Input
                id="quietEnd"
                type="time"
                dir="ltr"
                required
                value={form.quietEnd!}
                onChange={(e) => setForm({ ...form, quietEnd: e.target.value })}
              />
            </Field>
          </div>
        )}
      </fieldset>
      <Field label={t('dailyCap')} hint={t('dailyCapHint')} htmlFor="dailyCap">
        <Select
          id="dailyCap"
          value={form.dailyCap}
          onChange={(e) => setForm({ ...form, dailyCap: Number(e.target.value) })}
        >
          {[3, 4, 6, 8, 10, 12].map((n) => (
            <option key={n} value={n}>
              {nf.format(n)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? ts('saving') : ts('save')}
        </Button>
        {status && <Status tone={status.tone}>{status.text}</Status>}
      </div>
    </form>
  );
}

function AddCustom({ onAdded }: { onAdded: (r: ReminderRuleDto) => void }) {
  const t = useTranslations('reminders');
  const te = useTranslations('errors');
  const [title, setTitle] = useState('');
  const [timing, setTiming] = useState<Timing>({ type: 'fixed', time: '20:00' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onAdded(
            await api<ReminderRuleDto>('/reminders/rules', {
              method: 'POST',
              body: { customTitle: title.trim(), timing },
            }),
          );
          setTitle('');
        } catch (err) {
          setError(te(errorKey(err)));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t('customTitle')} htmlFor="customTitle">
        <Input
          id="customTitle"
          required
          maxLength={120}
          placeholder={t('customPlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <TimingEditor value={timing} onChange={setTiming} idPrefix="new-custom" />
      <Button type="submit" variant="ghost" className="self-start" disabled={busy || !title.trim()}>
        {t('addCustom')}
      </Button>
      {error && <Status tone="error">{error}</Status>}
    </form>
  );
}

function Upcoming({ version }: { version: number }) {
  const t = useTranslations('reminders');
  const locale = useLocale();
  const { me } = useMe();
  const [items, setItems] = useState<UpcomingReminder[] | null>(null);
  useEffect(() => {
    api<UpcomingReminder[]>('/reminders/upcoming').then(setItems, () => setItems([]));
  }, [version]);
  const fmt = useMemo(
    () => timeFormatter(locale, me.profile.digits, me.profile.timezone),
    [locale, me.profile],
  );
  if (!items) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-2 font-medium">{t('upcoming')}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t('upcomingEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {items.slice(0, 8).map((r) => (
            <li key={r.id} className={r.status === 'suppressed' ? 'text-muted' : ''}>
              <bdi className="tabular-nums">{fmt.format(new Date(r.fireAt))}</bdi> ·{' '}
              {t(`cat_${r.category}` as 'cat_quran')}
              {r.status === 'suppressed' && r.suppressReason && (
                <span className="ms-2">
                  ({t(`suppressed_${r.suppressReason}` as 'suppressed_quiet_hours')})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RemindersCard() {
  const t = useTranslations('reminders');
  const te = useTranslations('errors');
  const [rules, setRules] = useState<ReminderRuleDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => {
    api<ReminderRuleDto[]>('/reminders/rules').then(setRules, (err) => setError(te(errorKey(err))));
  }, [te]);

  const replace = (r: ReminderRuleDto) => {
    setRules((all) => all?.map((x) => (x.id === r.id ? r : x)) ?? null);
    bump();
  };
  const remove = async (id: string) => {
    try {
      await api(`/reminders/rules/${id}`, { method: 'DELETE' });
      setRules((all) => all?.filter((x) => x.id !== id) ?? null);
      bump();
    } catch (err) {
      setError(te(errorKey(err)));
    }
  };

  const builtIn = rules?.filter((r) => r.category !== 'custom') ?? [];
  const custom = rules?.filter((r) => r.category === 'custom') ?? [];

  return (
    <Card title={t('title')}>
      <p className="mb-4 text-sm text-muted">{t('intro')}</p>
      <PushRow />
      {error && <Status tone="error">{error}</Status>}
      <PrefsForm onSaved={bump} />
      {rules && (
        <>
          <h3 className="mt-6 font-medium">{t('builtIn')}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {builtIn.map((r) => (
              <RuleRow key={r.id} rule={r} onSaved={replace} />
            ))}
          </ul>
          <h3 className="mt-6 font-medium">{t('custom')}</h3>
          <p className="text-sm text-muted">{t('customHint')}</p>
          <ul className="flex flex-col divide-y divide-border">
            {custom.map((r) => (
              <RuleRow key={r.id} rule={r} onSaved={replace} onRemove={() => remove(r.id)} />
            ))}
          </ul>
          <AddCustom
            onAdded={(r) => {
              setRules((all) => [...(all ?? []), r]);
              bump();
            }}
          />
        </>
      )}
      <Upcoming version={version} />
    </Card>
  );
}
