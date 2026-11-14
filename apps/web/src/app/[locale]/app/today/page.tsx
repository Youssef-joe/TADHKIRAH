import { setRequestLocale } from 'next-intl/server';
import { TodayView } from '@/components/today-view';

export default async function TodayPage({ params }: PageProps<'/[locale]/app/today'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TodayView />;
}
