import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TodayDate } from '@/components/today-date';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/lib/server-api';

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const signedIn = (await getMe()) !== null;
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-12 sm:px-6">
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

      <Link
        href={signedIn ? '/app/today' : '/sign-in'}
        className="inline-flex min-h-12 items-center justify-center self-start rounded-lg bg-primary px-6 text-lg font-medium text-white hover:opacity-90"
      >
        {signedIn ? t('home.openApp') : t('home.start')}
      </Link>
    </main>
  );
}
