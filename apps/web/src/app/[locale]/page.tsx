import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AnimatedHeadline } from '@/components/landing/animated-headline';
import { DayTimeline } from '@/components/landing/day-timeline';
import { FeatureArt } from '@/components/landing/feature-art';
import { PhoneMockup } from '@/components/landing/phone-mockup';
import { HeroSky } from '@/components/sky/hero-sky';
import { TodayDate } from '@/components/today-date';
import { GeometricPattern, Ornament } from '@/components/ui/art';
import { Icon, type IconName } from '@/components/ui/icons';
import { Reveal } from '@/components/ui/reveal';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/server-api';

const FEATURES: { art: 'reflection' | 'worship' | 'quran' | 'sunnah'; n: 1 | 2 | 3 | 4 }[] = [
  { art: 'reflection', n: 1 },
  { art: 'worship', n: 2 },
  { art: 'quran', n: 3 },
  { art: 'sunnah', n: 4 },
];
const PRINCIPLES: { icon: IconName; n: 1 | 2 | 3 }[] = [
  { icon: 'lock', n: 1 },
  { icon: 'shield', n: 2 },
  { icon: 'heart', n: 3 },
];

export default async function Landing({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const ta = await getTranslations('app');
  const th = await getTranslations('home');
  const signedIn = (await getMe()) !== null;
  const other = locale === 'ar' ? 'en' : 'ar';
  const primaryHref = signedIn ? '/app/today' : '/sign-in';
  const primaryLabel = signedIn ? th('openApp') : t('ctaStart');

  return (
    <div className="overflow-x-clip">
      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <Icon name="sunnah" size={26} />
          <span className="font-display text-2xl font-bold">{ta('name')}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            locale={other}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:text-text"
          >
            {th('switchLanguage')}
          </Link>
          <Link
            href={primaryHref}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary"
          >
            {signedIn ? th('openApp') : t('navSignIn')}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <GeometricPattern
          id="hero-pattern"
          className="absolute inset-0 text-primary"
          opacity={0.06}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-6 pb-20 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-12">
          <div className="flex flex-col gap-6">
            <p className="tk-rise inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-surface/70 px-3 py-1 text-sm text-accent">
              <Icon name="times" size={16} />
              {t('eyebrow')}
            </p>
            <AnimatedHeadline
              text={t('heroTitle')}
              className="font-display text-4xl leading-tight font-bold text-text sm:text-5xl"
            />
            <p className="tk-rise tk-rise-2 max-w-xl text-lg leading-relaxed text-muted">
              {t('heroBody')}
            </p>
            <div className="tk-rise tk-rise-3 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-lg font-medium text-white shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
              >
                {primaryLabel}
                <Icon name="arrow" size={18} flipInRtl />
              </Link>
              <a
                href="#features"
                className="inline-flex min-h-12 items-center rounded-xl px-5 text-lg text-primary hover:bg-surface"
              >
                {t('ctaLearn')}
              </a>
            </div>
            <p className="tk-rise tk-rise-3 text-sm text-muted">{t('heroNote')}</p>
            <TodayDate />
          </div>
          <div className="tk-rise tk-rise-2">
            <HeroSky />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-8 border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mb-12 flex flex-col items-center gap-3 text-center">
            <Ornament className="text-accent" />
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('featuresTitle')}</h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ art, n }, i) => (
              <Reveal key={n} delay={i * 90}>
                <article className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-bg p-6 transition-colors hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                  <div className="-mx-2 rounded-xl bg-primary/5 py-2 transition-transform duration-500 group-hover:scale-[1.03]">
                    <FeatureArt kind={art} />
                  </div>
                  <h3 className="text-lg font-semibold">{t(`feature${n}Title`)}</h3>
                  <p className="leading-relaxed text-muted">{t(`feature${n}Body`)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Day starts at Fajr */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
        <Reveal className="order-2 md:order-1">
          <div className="tk-float">
            <div className="tk-tilt">
              <PhoneMockup />
            </div>
          </div>
        </Reveal>
        <Reveal className="order-1 flex flex-col gap-4 md:order-2" delay={100}>
          <span className="flex size-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Icon name="today" size={26} />
          </span>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('dayTitle')}</h2>
          <p className="text-lg leading-relaxed text-muted">{t('dayBody')}</p>
        </Reveal>
      </section>

      {/* A day with Tadhkirah */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Reveal className="mb-12 flex flex-col items-center gap-3 text-center">
          <Ornament className="text-accent" />
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('timelineTitle')}</h2>
        </Reveal>
        <DayTimeline />
      </section>

      {/* Principles */}
      <section className="bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mb-12 flex flex-col items-center gap-3 text-center">
            <Ornament className="text-accent" />
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('principlesTitle')}</h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {PRINCIPLES.map(({ icon, n }, i) => (
              <Reveal key={n} delay={i * 90}>
                <article className="flex h-full flex-col gap-3 rounded-2xl border border-transparent p-6 transition-colors duration-300 hover:border-border hover:bg-bg">
                  <Icon name={icon} size={28} className="text-primary" />
                  <h3 className="text-lg font-semibold">{t(`principle${n}Title`)}</h3>
                  <p className="leading-relaxed text-muted">{t(`principle${n}Body`)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-4 py-20 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#0b2a24] px-6 py-14 text-center text-[#f3e3bd]">
            <GeometricPattern
              id="cta-pattern"
              className="absolute inset-0 text-[#b08d3c]"
              opacity={0.12}
            />
            <div aria-hidden className="absolute inset-0 tk-shimmer" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full">
              {[8, 18, 30, 44, 57, 69, 81, 92].map((x, i) => (
                <span
                  key={x}
                  className="tk-spark absolute bottom-4 size-1.5 rounded-full bg-[#f6dfa4]"
                  style={{ insetInlineStart: `${x}%`, animationDelay: `${i * 0.85}s` }}
                />
              ))}
            </div>
            <div className="relative flex flex-col items-center gap-4">
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                {t('ctaTitle')}
              </h2>
              <p className="max-w-lg text-lg opacity-85">{t('ctaBody')}</p>
              <Link
                href={primaryHref}
                className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#f3e3bd] px-6 text-lg font-semibold text-[#0b2a24] transition-transform hover:-translate-y-0.5"
              >
                {primaryLabel}
                <Icon name="arrow" size={18} flipInRtl />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted sm:px-6">
          <p className="font-display text-lg text-primary">{ta('name')}</p>
          <p>{ta('tagline')}</p>
          <p>{t('footer')}</p>
        </div>
      </footer>
    </div>
  );
}
