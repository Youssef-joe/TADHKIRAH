import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { AdminDashboard } from '@/components/admin/dashboard';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export default async function AdminPage({ params }: PageProps<'/[locale]/admin'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cookie = (await headers()).get('cookie') ?? '';
  const res = await fetch(`${API}/v1/admin/me`, { headers: { cookie }, cache: 'no-store' });
  const { roles, twoPersonRule } = (await res.json()) as {
    roles: string[];
    twoPersonRule: boolean;
  };
  return <AdminDashboard roles={roles} twoPersonRule={twoPersonRule} />;
}
