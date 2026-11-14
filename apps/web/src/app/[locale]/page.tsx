import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { TodayDate } from '@/components/today-date';
import { Link } from '@/i18n/navigation';

const NAV = ['today', 'worship', 'reflection', 'sunnah', 'times', 'reports', 'settings'] as const;

export default function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-primary">{t('app.name')}</h1>
          <TodayDate />
        </div>
        <Link
          href="/"
          locale={other}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          {t('home.switchLanguage')}
        </Link>
      </header>

      <p className="text-xl leading-relaxed">{t('app.tagline')}</p>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-muted">{t('home.privacy')}</p>
      </section>

      <nav aria-label="primary">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NAV.map((key) => (
            <li
              key={key}
              className="rounded-lg border border-border px-4 py-3 text-start text-muted"
            >
              {t(`nav.${key}`)}
            </li>
          ))}
        </ul>
      </nav>

      <p className="text-sm text-accent">{t('home.comingSoon')}</p>
    </main>
  );
}
