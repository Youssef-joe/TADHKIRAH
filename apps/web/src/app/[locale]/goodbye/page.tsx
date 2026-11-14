import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Rendered per request so its scripts carry the CSP nonce (see src/proxy.ts). */
export const dynamic = 'force-dynamic';

/** Shown once after account deletion. */
export default async function GoodbyePage({ params }: PageProps<'/[locale]/goodbye'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('goodbye');
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="text-muted">{t('body')}</p>
      <Link href="/" className="text-primary underline-offset-4 hover:underline">
        {t('home')}
      </Link>
    </main>
  );
}
