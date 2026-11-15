import { setRequestLocale } from 'next-intl/server';
import { AdminReports } from '@/components/admin/reports';

export default async function ReportsPage({ params }: PageProps<'/[locale]/admin/reports'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminReports />;
}
