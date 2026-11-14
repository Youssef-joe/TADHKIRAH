import { setRequestLocale } from 'next-intl/server';
import { SettingsView } from '@/components/settings-view';

export default async function SettingsPage({ params }: PageProps<'/[locale]/app/settings'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsView />;
}
