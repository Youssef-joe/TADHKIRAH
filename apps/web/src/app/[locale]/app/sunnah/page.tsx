import { setRequestLocale } from 'next-intl/server';
import { SunnahView } from '@/components/content/sunnah-view';

export default async function SunnahPage({ params }: PageProps<'/[locale]/app/sunnah'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SunnahView />;
}
