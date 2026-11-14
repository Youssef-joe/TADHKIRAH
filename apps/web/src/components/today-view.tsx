'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  computePrayerTimes,
  formatHijri,
  nextPrayer,
  parseLocalDate,
  toPrayerLocation,
  trackingDate,
} from '@tadhkirah/domain';
import { Link } from '@/i18n/navigation';
import { formatDuration, timeFormatter } from '@/lib/format';
import { useMe } from './me-context';
import { skyAt, PREVIEW } from '@/lib/sky';
import { SkyScene } from './sky/sky-scene';
import { Icon } from './ui/icons';
import { Card } from './ui/primitives';
import { TodayWorship } from './worship/today-worship';

const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

/** Re-renders every 30 seconds so the countdown and the "next prayer" stay current. */
function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Today: greeting, the tracking day (it starts at Fajr where you are, ADR-001),
 * prayer times and the next prayer. Everything is computed on the device with
 * the shared domain package, so it works offline too.
 */
export function TodayView() {
  const t = useTranslations('today');
  const ts = useTranslations('shell');
  const tn = useTranslations('nav');
  const tp = useTranslations('prayers');
  const locale = useLocale() as 'ar' | 'en';
  const { me } = useMe();
  const now = useNow();
  const { timezone, digits } = me.profile;

  const data = useMemo(() => {
    if (!now || !me.prayerSettings) return null;
    const loc = toPrayerLocation(me.prayerSettings, timezone);
    const day = trackingDate(now, { kind: 'located', ...loc });
    const times = computePrayerTimes(day, loc);
    const tomorrow = computePrayerTimes(addDays(day, 1), loc);
    const next = nextPrayer(times, tomorrow, now);
    return { day, times, next, sky: skyAt(now, times, tomorrow) };
  }, [now, me.prayerSettings, timezone]);

  const fmt = timeFormatter(locale, digits, timezone);
  const dateLabel = useMemo(() => {
    if (!data) return '';
    const { year, month, day: d } = parseLocalDate(data.day);
    const gregorian = new Intl.DateTimeFormat(`${locale}-u-nu-${digits}`, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(Date.UTC(year, month - 1, d, 12)));
    return `${gregorian} · ${formatHijri(data.day, locale, { offsetDays: me.preferences.hijriOffset, digits })}`;
  }, [data, locale, digits, me.preferences.hijriOffset]);

  const name = me.profile.displayName;
  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl bg-[#0b2a24] p-6 text-[#f3e3bd]">
        {/* The sky over your city right now (it follows your prayer times). */}
        <SkyScene
          state={data?.sky ?? PREVIEW.night}
          id="today-sky"
          className="absolute inset-0 h-full w-full"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/20"
        />
        <div className="relative flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold text-white">
            {name ? ts('greeting', { name }) : ts('greetingNoName')}
          </h1>
          <p className="min-h-[1.5em] opacity-85" aria-live="polite">
            {dateLabel}
          </p>
          {data && (
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm opacity-75">{t('nextPrayerLabel')}</p>
                <p className="text-2xl font-semibold text-white">
                  {t('nextPrayer', {
                    prayer: tp(data.next.name),
                    duration: formatDuration(
                      data.next.at.getTime() - now!.getTime(),
                      locale,
                      digits,
                    ),
                  })}
                </p>
              </div>
              <p className="text-3xl font-semibold tabular-nums text-white">
                {fmt.format(data.next.at)}
              </p>
            </div>
          )}
        </div>
      </header>

      {data && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Icon name="clock" className="text-primary" /> {t('prayerTimes')}
            </h2>
            <Link
              href="/app/settings#prayer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Icon name="pin" size={16} />
              {me.prayerSettings!.locationLabel}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ORDER.map((p) => {
              const isNext =
                data.next.name === p && data.next.at.getTime() === data.times[p].getTime();
              const passed = now! > data.times[p];
              return (
                <li
                  key={p}
                  aria-current={isNext ? 'time' : undefined}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    isNext
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border'
                  } ${passed && !isNext ? 'text-muted' : ''}`}
                >
                  <span>{tp(p)}</span>
                  <span className="tabular-nums">{fmt.format(data.times[p])}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-muted">
            {t('dayBounds', {
              time: fmt.format(data.times.fajr),
              place: me.prayerSettings!.locationLabel,
            })}
          </p>
        </Card>
      )}

      <TodayWorship />

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-3 text-sm font-medium text-muted">
          {t('upcoming')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['reflection', 'reflection'],
              ['reports', 'reports'],
            ] as const
          ).map(([k, icon]) => (
            <li key={k}>
              <Link
                href={`/app/${k}`}
                className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-muted hover:bg-surface"
              >
                <Icon name={icon} />
                {tn(k)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
