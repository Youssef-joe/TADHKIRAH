'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { addDays, computePrayerTimes, trackingDate, type PrayerLocation } from '@tadhkirah/domain';
import { PREVIEW, skyAt, type SkyPhase, type SkyState } from '@/lib/sky';
import { Lantern } from './lantern';
import { SkyScene } from './sky-scene';

const MAKKAH: PrayerLocation = {
  latitude: 21.42,
  longitude: 39.83,
  timeZone: 'Asia/Riyadh',
  method: 'UmmAlQura',
};
const CHIPS: SkyPhase[] = ['fajr', 'sunrise', 'day', 'asr', 'maghrib', 'isha'];

function liveSky(): SkyState {
  const now = new Date();
  const day = trackingDate(now, { kind: 'located', ...MAKKAH });
  return skyAt(now, computePrayerTimes(day, MAKKAH), computePrayerTimes(addDays(day, 1), MAKKAH));
}

/**
 * Landing hero: the sky over Makkah right now, following the real prayer times.
 * It starts at night and "dawns" into the live sky, and visitors can tap a prayer
 * time to watch the sky change.
 */
export function HeroSky() {
  const t = useTranslations('landing');
  const tp = useTranslations('phases');
  const [live, setLive] = useState<SkyState>(PREVIEW.night);
  const [preview, setPreview] = useState<SkyPhase | null>(null);

  useEffect(() => {
    const id1 = setTimeout(() => setLive(liveSky()), 350); // the opening "dawn"
    const id2 = setInterval(() => setLive(liveSky()), 60_000);
    return () => {
      clearTimeout(id1);
      clearInterval(id2);
    };
  }, []);

  const state = preview ? PREVIEW[preview] : live;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <Lantern className="absolute -top-6 start-2 z-10 w-10 sm:-start-6 sm:w-12" chain={50} />
      <Lantern
        className="absolute -top-6 end-4 z-10 w-8 sm:-end-4 sm:w-10"
        chain={90}
        delay={1.3}
      />
      <SkyScene state={state} id="hero" framed parallax className="h-auto w-full drop-shadow-2xl" />

      <div className="mt-4 flex flex-col items-center gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {t('skyLive', { phase: tp(live.phase) })}
        </p>
        <div
          role="group"
          aria-label={t('skyHint')}
          className="flex flex-wrap justify-center gap-1.5"
        >
          <button
            type="button"
            aria-pressed={preview === null}
            onClick={() => setPreview(null)}
            className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
          >
            {t('skyNow')}
          </button>
          {CHIPS.map((ph) => (
            <button
              key={ph}
              type="button"
              aria-pressed={preview === ph}
              onClick={() => setPreview(ph)}
              className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white"
            >
              {tp(ph)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
