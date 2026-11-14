'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { PrayerSettings, Profile } from '@tadhkirah/contracts';
import { api, errorKey } from '@/lib/api';
import { useMe } from '../me-context';
import { Button, Card, Field, Input, Status } from '../ui/primitives';
import { LocationPicker, type PickedLocation } from './location-picker';
import { MethodFields, TimesPreview } from './method-fields';

const ADJUSTABLE = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

/** Settings → Prayer times: location, method, minute adjustments and khutbah time. */
export function PrayerSettingsCard() {
  const t = useTranslations('settings');
  const tp = useTranslations('prayers');
  const te = useTranslations('errors');
  const { me, setMe } = useMe();
  const initial = me.prayerSettings!;
  const [form, setForm] = useState<PrayerSettings>(initial);
  const [timeZone, setTimeZone] = useState(me.profile.timezone);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function pick(l: PickedLocation) {
    const { timeZone: tz, ...where } = l;
    setForm({ ...form, ...where });
    setTimeZone(tz);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const prayerSettings = await api<PrayerSettings>('/me/prayer-settings', {
        method: 'PUT',
        body: form,
      });
      let profile = me.profile;
      if (timeZone !== me.profile.timezone) {
        profile = await api<Profile>('/me/profile', {
          method: 'PATCH',
          body: { timezone: timeZone },
        });
      }
      setMe({ ...me, prayerSettings, profile });
      setStatus({ tone: 'ok', text: t('saved') });
    } catch (err) {
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="prayer" className="scroll-mt-6">
      <Card title={t('prayer')}>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <LocationPicker value={{ ...form, timeZone }} onChange={pick} />
          <MethodFields
            value={form}
            onChange={(m) => setForm({ ...form, ...m })}
            latitude={form.latitude}
          />
          <Field label={t('adjustments')} hint={t('adjustmentsHint')} htmlFor="adj-fajr">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {ADJUSTABLE.map((p) => (
                <label key={p} className="flex flex-col gap-1 text-xs text-muted">
                  {tp(p)}
                  <Input
                    id={`adj-${p}`}
                    type="number"
                    dir="ltr"
                    min={-30}
                    max={30}
                    value={form.adjustments[p] ?? 0}
                    onChange={(e) => {
                      const n = Math.max(
                        -30,
                        Math.min(30, Math.trunc(Number(e.target.value) || 0)),
                      );
                      const adjustments = { ...form.adjustments, [p]: n };
                      if (n === 0) delete adjustments[p];
                      setForm({ ...form, adjustments });
                    }}
                  />
                </label>
              ))}
            </div>
          </Field>
          <Field label={t('khutbah')} hint={t('khutbahHint')} htmlFor="khutbah">
            <Input
              id="khutbah"
              type="time"
              dir="ltr"
              className="max-w-40"
              value={form.jumuahKhutbahTime ?? ''}
              onChange={(e) => setForm({ ...form, jumuahKhutbahTime: e.target.value || null })}
            />
          </Field>
          <TimesPreview settings={form} timeZone={timeZone} digits={me.profile.digits} />
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={busy}>
              {busy ? t('saving') : t('save')}
            </Button>
            {status && <Status tone={status.tone}>{status.text}</Status>}
          </div>
        </form>
      </Card>
    </div>
  );
}
