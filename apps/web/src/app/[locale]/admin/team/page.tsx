import { setRequestLocale } from 'next-intl/server';
import { AdminTeam } from '@/components/admin/team';

export default async function TeamPage({ params }: PageProps<'/[locale]/admin/team'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminTeam />;
}
