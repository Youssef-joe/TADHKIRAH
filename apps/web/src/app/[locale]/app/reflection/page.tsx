import { setRequestLocale } from 'next-intl/server';
import { ReflectionView } from '@/components/reflection/reflection-view';

export default async function ReflectionPage({ params }: PageProps<'/[locale]/app/reflection'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReflectionView />;
}
