import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '../ui/icons';
import { Reveal } from '../ui/reveal';

const STEPS: { prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; icon: IconName }[] = [
  { prayer: 'fajr', icon: 'today' },
  { prayer: 'dhuhr', icon: 'worship' },
  { prayer: 'asr', icon: 'book' },
  { prayer: 'maghrib', icon: 'sunnah' },
  { prayer: 'isha', icon: 'reflection' },
];

/** "A day with Tadhkirah": five moments from Fajr to Isha. The line fills in as it scrolls into view. */
export async function DayTimeline() {
  const t = await getTranslations('landing');
  const tp = await getTranslations('prayers');

  return (
    <Reveal className="relative">
      <div
        aria-hidden
        className="absolute inset-y-6 start-6 w-0.5 bg-border md:inset-x-10 md:inset-y-auto md:top-6 md:h-0.5 md:w-auto"
      >
        <div className="tk-fill h-full w-full origin-top bg-gradient-to-b from-primary to-accent md:origin-[left] md:bg-gradient-to-r rtl:md:origin-[right]" />
      </div>
      <ol className="relative grid gap-8 md:grid-cols-5 md:gap-4">
        {STEPS.map(({ prayer, icon }, i) => (
          <li key={prayer} className="flex gap-4 md:flex-col md:items-center md:text-center">
            <span
              className="tk-pop relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-bg text-primary shadow-md"
              style={{ animationDelay: `${300 + i * 220}ms` }}
            >
              <Icon name={icon} size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold text-accent">{tp(prayer)}</p>
              <h3 className="font-semibold">{t(`t${i + 1}Title`)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(`t${i + 1}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
