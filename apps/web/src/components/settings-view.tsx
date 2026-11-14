'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Preferences, Profile, SessionInfo } from '@tadhkirah/contracts';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api, errorKey } from '@/lib/api';
import { useMe } from './me-context';
import { PrivacyCard } from './privacy-card';
import { PrayerSettingsCard } from './prayer/prayer-settings-card';
import { RemindersCard } from './reminders/reminders-card';
import { Button, Card, Field, Input, Select, Status } from './ui/primitives';

type SaveState = { tone: 'ok' | 'error'; text: string } | null;

function useSaver() {
  const t = useTranslations('settings');
  const te = useTranslations('errors');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<SaveState>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ tone: 'ok', text: t('saved') });
    } catch (err) {
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  }
  return { busy, status, run };
}

function ProfileCard() {
  const t = useTranslations('settings');
  const { me, setMe } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState<Profile>(me.profile);
  const { busy, status, run } = useSaver();
  const deviceTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes(form.timezone) ? all : [form.timezone, ...all];
  }, [form.timezone]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const profile = await api<Profile>('/me/profile', {
        method: 'PATCH',
        body: { ...form, displayName: form.displayName?.trim() || null },
      });
      setMe({ ...me, profile });
      if (profile.locale !== me.profile.locale)
        router.replace(pathname, { locale: profile.locale });
    });
  };

  return (
    <Card title={t('profile')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('displayName')} hint={t('displayNameHint')} htmlFor="displayName">
          <Input
            id="displayName"
            maxLength={60}
            autoComplete="nickname"
            value={form.displayName ?? ''}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('language')} htmlFor="locale">
            <Select
              id="locale"
              value={form.locale}
              onChange={(e) => setForm({ ...form, locale: e.target.value as Profile['locale'] })}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label={t('digits')} htmlFor="digits">
            <Select
              id="digits"
              value={form.digits}
              onChange={(e) => setForm({ ...form, digits: e.target.value as Profile['digits'] })}
            >
              <option value="arab">{t('digitsArab')}</option>
              <option value="latn">{t('digitsLatn')}</option>
            </Select>
          </Field>
        </div>
        <Field label={t('timezone')} htmlFor="timezone">
          <Select
            id="timezone"
            dir="ltr"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        {deviceTz !== form.timezone && (
          <Button
            type="button"
            variant="quiet"
            className="self-start"
            onClick={() => setForm({ ...form, timezone: deviceTz })}
          >
            {t('useDeviceTimezone', { tz: deviceTz })}
          </Button>
        )}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy}>
            {busy ? t('saving') : t('save')}
          </Button>
          {status && <Status tone={status.tone}>{status.text}</Status>}
        </div>
      </form>
    </Card>
  );
}

function PreferencesCard() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { me, setMe } = useMe();
  const [form, setForm] = useState<Preferences>(me.preferences);
  const { busy, status, run } = useSaver();

  // Localized weekday names: 2026-11-15 was a Sunday (index 0).
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 10, 15 + i))));
  }, [locale]);

  const offsetLabel = (n: number) =>
    n === 0 ? t('noAdjustment') : `${n > 0 ? '+' : '−'}${t('days', { n: Math.abs(n) })}`;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const preferences = await api<Preferences>('/me/preferences', {
        method: 'PATCH',
        body: form,
      });
      setMe({ ...me, preferences });
    });
  };

  return (
    <Card title={t('preferences')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('weekStart')} htmlFor="weekStart">
            <Select
              id="weekStart"
              value={form.weekStart}
              onChange={(e) => setForm({ ...form, weekStart: Number(e.target.value) })}
            >
              {[6, 0, 1].map((d) => (
                <option key={d} value={d}>
                  {weekdays[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('theme')} htmlFor="theme">
            <Select
              id="theme"
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value as Preferences['theme'] })}
            >
              <option value="system">{t('themeSystem')}</option>
              <option value="light">{t('themeLight')}</option>
              <option value="dark">{t('themeDark')}</option>
            </Select>
          </Field>
        </div>
        <Field label={t('hijriOffset')} hint={t('hijriOffsetHint')} htmlFor="hijriOffset">
          <Select
            id="hijriOffset"
            value={form.hijriOffset}
            onChange={(e) => setForm({ ...form, hijriOffset: Number(e.target.value) })}
          >
            {[-2, -1, 0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {offsetLabel(n)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy}>
            {busy ? t('saving') : t('save')}
          </Button>
          {status && <Status tone={status.tone}>{status.text}</Status>}
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const t = useTranslations('settings');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { me } = useMe();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionInfo[]>('/auth/sessions')
      .then(setSessions)
      .catch((err) => setError(te(errorKey(err))));
  }, [te]);

  const fmt = new Intl.DateTimeFormat(`${locale}-u-nu-${me.profile.digits}`, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: me.profile.timezone,
  });

  async function revoke(id: string) {
    try {
      await api(`/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((s) => s?.filter((x) => x.id !== id) ?? null);
    } catch (err) {
      setError(te(errorKey(err)));
    }
  }

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign(`/${locale}`);
  }

  return (
    <Card title={t('sessions')}>
      <p className="mb-4 text-sm text-muted">{t('sessionsHint')}</p>
      {error && <Status tone="error">{error}</Status>}
      <ul className="flex flex-col divide-y divide-border">
        {sessions?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">
                {s.deviceLabel ?? t('unknownDevice')}
                {s.current && (
                  <span className="ms-2 text-sm font-normal text-primary">· {t('thisDevice')}</span>
                )}
              </p>
              <p className="text-sm text-muted">
                {t('lastActive', { date: fmt.format(new Date(s.lastSeenAt)) })}
              </p>
            </div>
            {!s.current && (
              <Button variant="ghost" onClick={() => revoke(s.id)}>
                {t('revoke')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="mt-4" onClick={signOut}>
        {t('signOut')}
      </Button>
    </Card>
  );
}

export function SettingsView() {
  const t = useTranslations('settings');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <ProfileCard />
      <PrayerSettingsCard />
      <div id="reminders" className="scroll-mt-6">
        <RemindersCard />
      </div>
      <PreferencesCard />
      <SessionsCard />
      <PrivacyCard />
    </div>
  );
}
