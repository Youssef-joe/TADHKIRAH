import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { WorshipView } from '@/components/worship/worship-view';

export default async function WorshipPage({ params }: PageProps<'/[locale]/app/worship'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <WorshipView />
    </Suspense>
  );
}
