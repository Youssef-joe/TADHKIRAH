import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { LegalLinks } from '@/components/legal-page';
import { SignInForm } from '@/components/sign-in-form';
import { GeometricPattern } from '@/components/ui/art';
import { Icon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { getMe, getOAuthProviders } from '@/lib/server-api';

export default async function SignInPage({ params, searchParams }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const { oauth } = await searchParams;
  setRequestLocale(locale);
  if (await getMe()) redirect(`/${locale}/app/today`);
  const t = await getTranslations('auth');
  const tl = await getTranslations('legal');
  const providers = await getOAuthProviders();

  return (
    <div className="relative min-h-dvh">
      <GeometricPattern
        id="signin-pattern"
        className="absolute inset-0 text-primary"
        opacity={0.05}
      />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-sm text-muted hover:text-primary"
        >
          <Icon name="arrow" size={16} className="rotate-180 rtl:rotate-0" />
          {t('backHome')}
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="sunnah" size={26} />
          </span>
          <h1 className="font-display text-3xl font-bold text-primary">{t('title')}</h1>
          <p className="mt-2 mb-6 text-muted">{t('subtitle')}</p>
          <SignInForm
            providers={providers}
            oauthError={typeof oauth === 'string' ? oauth : undefined}
          />
        </div>
        <div className="flex flex-col gap-2 text-center text-xs text-muted">
          <p>{tl('signInNote')}</p>
          <LegalLinks />
        </div>
      </main>
    </div>
  );
}
