import { getLocale, getTranslations } from 'next-intl/server';
import {
  computePrayerTimes,
  formatHijri,
  nextPrayer,
  addDays,
  trackingDate,
  type PrayerLocation,
} from '@tadhkirah/domain';

const MAKKAH: PrayerLocation = {
  latitude: 21.42,
  longitude: 39.83,
  timeZone: 'Asia/Riyadh',
  method: 'UmmAlQura',
};

const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

/**
 * A phone showing the Today screen, built in HTML/CSS (not a picture) with real
 * prayer times for Makkah from the shared domain package.
 */
export async function PhoneMockup() {
  const locale = (await getLocale()) as 'ar' | 'en';
  const t = await getTranslations('prayers');
  const tl = await getTranslations('landing');
  const now = new Date();
  const day = trackingDate(now, { kind: 'located', ...MAKKAH });
  const times = computePrayerTimes(day, MAKKAH);
  const next = nextPrayer(times, computePrayerTimes(addDays(day, 1), MAKKAH), now);
  const nu = locale === 'ar' ? 'arab' : 'latn';
  const fmt = new Intl.DateTimeFormat(`${locale}-u-nu-${nu}`, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: MAKKAH.timeZone,
  });

  return (
    <div className="relative mx-auto w-[260px] rounded-[2.5rem] border-[10px] border-[#0b2a24] bg-bg shadow-2xl shadow-black/20">
      <div className="absolute inset-x-0 top-2 mx-auto h-5 w-20 rounded-full bg-[#0b2a24]" />
      <div className="flex flex-col gap-3 px-4 pt-10 pb-6">
        <p className="font-display text-lg text-primary">
          {locale === 'ar' ? 'مَكَّةُ الْمُكَرَّمَة' : 'Makkah'}
        </p>
        <p className="-mt-2 text-xs text-muted">{formatHijri(day, locale)}</p>
        <div className="rounded-2xl bg-primary p-3 text-white">
          <p className="text-[11px] opacity-80">{tl('mockNext')}</p>
          <p className="text-lg font-semibold">
            {t(next.name)} · <span dir="ltr">{fmt.format(next.at)}</span>
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
          {ORDER.map((p) => (
            <li
              key={p}
              className={`flex items-center justify-between px-3 py-2 ${p === next.name ? 'font-semibold text-primary' : ''}`}
            >
              <span>{t(p)}</span>
              <span className="tabular-nums text-muted">{fmt.format(times[p])}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border border-dashed border-accent/60 p-3 text-xs text-muted">
          {tl('mockReflect')}
        </div>
      </div>
    </div>
  );
}
