import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { MeProvider } from '@/components/me-context';
import { Pwa } from '@/components/pwa';
import { getEditorialRoles, getMe } from '@/lib/server-api';

/** The review desk (ADR-003): editorial roles only. Everyone else gets a 404. */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]/admin'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await getMe();
  if (!me) redirect(`/${locale}/sign-in`);
  const roles = await getEditorialRoles();
  if (!roles.length) notFound();
  const t = await getTranslations('admin');
  return (
    <MeProvider initial={me}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Pwa />
        <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
        <AdminNav roles={roles} />
        {children}
      </main>
    </MeProvider>
  );
}
