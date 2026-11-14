import { setRequestLocale } from 'next-intl/server';
import { InboxView } from '@/components/reminders/inbox-view';

export default async function InboxPage({ params }: PageProps<'/[locale]/app/inbox'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InboxView />;
}
