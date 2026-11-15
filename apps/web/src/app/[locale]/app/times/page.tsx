import { setRequestLocale } from 'next-intl/server';
import { TimesView } from '@/components/content/times-view';

export default async function TimesPage({ params }: PageProps<'/[locale]/app/times'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TimesView />;
}
