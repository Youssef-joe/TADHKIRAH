import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/sign-in-form';
import { getMe } from '@/lib/server-api';

export default async function SignInPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getMe()) redirect(`/${locale}/app/today`);
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-primary">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
      </div>
      <SignInForm />
    </main>
  );
}
