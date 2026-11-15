import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminList } from '@/components/admin/list';
import { TYPES, type AdminType } from '@/components/admin/shared';

export default async function AdminListPage({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/[type]'>) {
  const { locale, type } = await params;
  if (!(TYPES as readonly string[]).includes(type)) notFound();
  setRequestLocale(locale);
  const status = (await searchParams).status;
  return (
    <AdminList
      key={type}
      type={type as AdminType}
      initialStatus={typeof status === 'string' ? status : undefined}
    />
  );
}
