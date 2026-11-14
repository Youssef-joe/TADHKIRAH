'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { PrayerSettingsInput } from '@tadhkirah/contracts';
import {
  CALCULATION_METHODS,
  computePrayerTimes,
  toPrayerLocation,
  trackingDate,
} from '@tadhkirah/domain';
import { timeFormatter, type Digits } from '@/lib/format';
import { Field, Select } from '../ui/primitives';

export type MethodValue = Pick<PrayerSettingsInput, 'method' | 'asrMethod' | 'highLatRule'>;

/** Method, Asr and (for high latitudes) the high-latitude rule. */
export function MethodFields({
  value,
  onChange,
  latitude,
}: {
  value: MethodValue;
  onChange: (v: MethodValue) => void;
  latitude: number;
}) {
  const t = useTranslations('onboarding');
  const tm = useTranslations('methods');
  const showHighLat = Math.abs(latitude) >= 45 || value.highLatRule;

  return (
    <div className="flex flex-col gap-4">
      <Field label={t('method')} htmlFor="method">
        <Select
          id="method"
          value={value.method}
          onChange={(e) => onChange({ ...value, method: e.target.value as MethodValue['method'] })}
        >
          {CALCULATION_METHODS.map((m) => (
            <option key={m} value={m}>
              {tm(m)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('asr')} htmlFor="asr">
        <Select
          id="asr"
          value={value.asrMethod ?? 'standard'}
          onChange={(e) =>
            onChange({ ...value, asrMethod: e.target.value as 'standard' | 'hanafi' })
          }
        >
          <option value="standard">{t('asrStandard')}</option>
          <option value="hanafi">{t('asrHanafi')}</option>
        </Select>
      </Field>
      {showHighLat && (
        <Field label={t('highLat')} hint={t('highLatHint')} htmlFor="highlat">
          <Select
            id="highlat"
            value={value.highLatRule ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                highLatRule: (e.target.value || null) as MethodValue['highLatRule'],
              })
            }
          >
            <option value="">{t('highLatNone')}</option>
            <option value="middle_of_night">{t('highLatMiddle')}</option>
            <option value="seventh_of_night">{t('highLatSeventh')}</option>
            <option value="twilight_angle">{t('highLatAngle')}</option>
          </Select>
        </Field>
      )}
    </div>
  );
}

const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

/** Today's times for the settings being edited, so the user can compare with their mosque. */
export function TimesPreview({
  settings,
  timeZone,
  digits,
}: {
  settings: PrayerSettingsInput;
  timeZone: string;
  digits: Digits;
}) {
  const t = useTranslations('onboarding');
  const tp = useTranslations('prayers');
  const locale = useLocale();
  const loc = toPrayerLocation(
    {
      ...settings,
      asrMethod: settings.asrMethod ?? 'standard',
      adjustments: settings.adjustments ?? {},
    },
    timeZone,
  );
  const day = trackingDate(new Date(), { kind: 'located', ...loc });
  const times = computePrayerTimes(day, loc);
  const fmt = timeFormatter(locale, digits, timeZone);

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <p className="mb-3 text-sm text-muted">{t('preview')}</p>
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ORDER.map((p) => (
          <div key={p} className="flex flex-col items-center gap-1 rounded-lg bg-surface p-2">
            <dt className="text-xs text-muted">{tp(p)}</dt>
            <dd className="font-semibold tabular-nums">{fmt.format(times[p])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
