import type { DailyPrayerTimes } from '@tadhkirah/domain';

/**
 * The "living sky": what the sky looks like during each part of the prayer day.
 * It's purely visual. Phases follow the real prayer times of a place.
 */
export type SkyPhase = 'night' | 'fajr' | 'sunrise' | 'day' | 'asr' | 'maghrib' | 'isha';

export interface SkyPalette {
  top: string;
  mid: string;
  horizon: string;
  glow: string;
  /** Silhouette colours: distant skyline, mosque, foreground. */
  back: string;
  main: string;
  front: string;
  stars: number;
  windows: number;
  sun: string;
}

export const PALETTES: Record<SkyPhase, SkyPalette> = {
  night: {
    top: '#040b17',
    mid: '#0a2233',
    horizon: '#123c3d',
    glow: '#1c4a47',
    back: '#0d2729',
    main: '#061719',
    front: '#030f0e',
    stars: 1,
    windows: 1,
    sun: '#fff3c4',
  },
  fajr: {
    top: '#0b1d38',
    mid: '#2b4a6f',
    horizon: '#c98a6a',
    glow: '#f2b48a',
    back: '#253f4c',
    main: '#0e2426',
    front: '#081816',
    stars: 0.4,
    windows: 0.7,
    sun: '#ffd9a8',
  },
  sunrise: {
    top: '#3c6c9c',
    mid: '#8db5d4',
    horizon: '#f6d19a',
    glow: '#ffe1a6',
    back: '#4f7c80',
    main: '#1a3f3b',
    front: '#10302b',
    stars: 0,
    windows: 0,
    sun: '#fff1c2',
  },
  day: {
    top: '#2b7ab4',
    mid: '#7cbde4',
    horizon: '#e6f3f0',
    glow: '#fff7dc',
    back: '#6a9b96',
    main: '#1f4d47',
    front: '#14382f',
    stars: 0,
    windows: 0,
    sun: '#fffbe6',
  },
  asr: {
    top: '#356f9f',
    mid: '#97bfd5',
    horizon: '#f1d79d',
    glow: '#ffd889',
    back: '#5e8a80',
    main: '#1c443d',
    front: '#123229',
    stars: 0,
    windows: 0,
    sun: '#ffe7a3',
  },
  maghrib: {
    top: '#281f4c',
    mid: '#9c4559',
    horizon: '#f08749',
    glow: '#ffae62',
    back: '#4a3550',
    main: '#1a1424',
    front: '#100c16',
    stars: 0.15,
    windows: 0.6,
    sun: '#ffab55',
  },
  isha: {
    top: '#0c1530',
    mid: '#23375f',
    horizon: '#57466b',
    glow: '#86698c',
    back: '#1d2a40',
    main: '#0b1424',
    front: '#060c17',
    stars: 0.75,
    windows: 0.95,
    sun: '#fff3c4',
  },
};

export interface SkyState {
  phase: SkyPhase;
  /** Sun's position along its arc: 0 = sunrise, 1 = sunset. Outside 0–1 = below the horizon. */
  sun: number;
  /** Moon's position along its night arc (0 = Maghrib, 1 = next Fajr). */
  moon: number;
}

const MIN = 60_000;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** The live sky for `now`, given today's and tomorrow's prayer times. */
export function skyAt(now: Date, today: DailyPrayerTimes, tomorrow: DailyPrayerTimes): SkyState {
  const t = now.getTime();
  const at = (d: Date) => d.getTime();
  const sun = (t - at(today.sunrise)) / (at(today.maghrib) - at(today.sunrise));
  const nightStart = at(today.maghrib);
  const moon =
    t >= nightStart
      ? (t - nightStart) / (at(tomorrow.fajr) - nightStart)
      : // Before Fajr: we're in the second half of last night.
        0.5 + clamp((t - at(today.fajr) + 6 * 60 * MIN) / (12 * 60 * MIN), 0, 0.5);

  let phase: SkyPhase;
  if (t < at(today.fajr)) phase = 'night';
  else if (t < at(today.sunrise)) phase = 'fajr';
  else if (t < at(today.sunrise) + 45 * MIN) phase = 'sunrise';
  else if (t < at(today.asr)) phase = 'day';
  else if (t < at(today.maghrib) - 25 * MIN) phase = 'asr';
  else if (t < at(today.maghrib) + 20 * MIN) phase = 'maghrib';
  else if (t < at(today.isha) + 40 * MIN) phase = 'isha';
  else phase = 'night';

  return { phase, sun, moon: clamp(moon, 0, 1) };
}

/** A representative sky for each phase, used when a visitor previews a prayer time. */
export const PREVIEW: Record<SkyPhase, SkyState> = {
  night: { phase: 'night', sun: -0.3, moon: 0.55 },
  fajr: { phase: 'fajr', sun: -0.04, moon: 0.95 },
  sunrise: { phase: 'sunrise', sun: 0.05, moon: 1 },
  day: { phase: 'day', sun: 0.48, moon: 1 },
  asr: { phase: 'asr', sun: 0.74, moon: 1 },
  maghrib: { phase: 'maghrib', sun: 0.985, moon: 0 },
  isha: { phase: 'isha', sun: 1.2, moon: 0.12 },
};

/** Point on the sun/moon arc in the scene's 480×520 coordinate space (horizon at y=380). */
export function arcPoint(p: number): { x: number; y: number } {
  const x = 40 + p * 400;
  const y = 380 - Math.sin(Math.PI * clamp(p, -0.15, 1.15)) * 250;
  return { x, y };
}
