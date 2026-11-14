import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/prayer/onboarding-flow';
import { GeometricPattern } from '@/components/ui/art';
import { getMe } from '@/lib/server-api';

export default async function OnboardingPage({ params }: PageProps<'/[locale]/onboarding'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await getMe();
  if (!me) redirect(`/${locale}/sign-in`);
  if (me.onboarded) redirect(`/${locale}/app/today`);
  const t = await getTranslations('onboarding');

  return (
    <div className="relative min-h-dvh">
      <GeometricPattern
        id="onboarding-pattern"
        className="absolute inset-0 text-primary"
        opacity={0.05}
      />
      <main className="relative mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
        <header>
          <h1 className="font-display text-3xl font-bold text-primary">{t('title')}</h1>
          <p className="mt-2 text-muted">{t('subtitle')}</p>
        </header>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <OnboardingFlow digits={me.profile.digits} />
        </div>
      </main>
    </div>
  );
}
