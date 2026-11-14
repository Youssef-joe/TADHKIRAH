import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { MeProvider } from '@/components/me-context';
import { getMe } from '@/lib/server-api';

/** Everything under /app needs a session. Signed-out visitors go to sign-in. */
export default async function AppLayout({ children, params }: LayoutProps<'/[locale]/app'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await getMe();
  if (!me) redirect(`/${locale}/sign-in`);

  return (
    <MeProvider initial={me}>
      <div className="flex min-h-dvh">
        <AppNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-24 sm:px-6 md:pb-12">
          {children}
        </main>
      </div>
    </MeProvider>
  );
}
