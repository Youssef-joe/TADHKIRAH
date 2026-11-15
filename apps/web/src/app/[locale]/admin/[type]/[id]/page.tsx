import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminEditor } from '@/components/admin/editor';
import { TYPES, type AdminType } from '@/components/admin/shared';

const UUID = /^[0-9a-f-]{36}$/;

export default async function AdminEditorPage({
  params,
}: PageProps<'/[locale]/admin/[type]/[id]'>) {
  const { locale, type, id } = await params;
  if (!(TYPES as readonly string[]).includes(type) || !UUID.test(id)) notFound();
  setRequestLocale(locale);
  return <AdminEditor key={id} type={type as AdminType} id={id} />;
}
