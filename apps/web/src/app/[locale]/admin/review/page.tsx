import { setRequestLocale } from 'next-intl/server';
import { ReviewQueue } from '@/components/admin/review-queue';

export default async function ReviewQueuePage({ params }: PageProps<'/[locale]/admin/review'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReviewQueue />;
}
