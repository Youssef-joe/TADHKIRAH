import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/icons';

/** Sections that aren't built yet, with the milestone that delivers each one (docs/06-roadmap.md). */
const UPCOMING: Record<string, string> = {
  worship: 'M3',
  reflection: 'M5',
  reports: 'M7',
  sunnah: 'P2',
  times: 'P2',
};

export default async function UpcomingSection({ params }: PageProps<'/[locale]/app/[section]'>) {
  const { locale, section } = await params;
  const milestone = UPCOMING[section];
  if (!milestone) notFound();
  setRequestLocale(locale);
  const tNav = await getTranslations('nav');
  const t = await getTranslations('comingSoon');

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon name={section as IconName} size={32} />
      </span>
      <h1 className="font-display text-3xl font-bold">{tNav(section as 'worship')}</h1>
      <p className="text-muted">
        {t('title')} — {t('body', { milestone })}
      </p>
    </div>
  );
}
