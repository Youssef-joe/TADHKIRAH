import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalPage } from '@/components/legal-page';

/** Rendered per request so its scripts carry the CSP nonce (see src/proxy.ts). */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return { title: t('privacy.title') };
}

export default async function Page({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc="privacy" locale={locale} />;
}
