'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon, type IconName } from './ui/icons';

export const SECTIONS: readonly { key: IconName; href: string }[] = [
  { key: 'today', href: '/app/today' },
  { key: 'worship', href: '/app/worship' },
  { key: 'reflection', href: '/app/reflection' },
  { key: 'sunnah', href: '/app/sunnah' },
  { key: 'times', href: '/app/times' },
  { key: 'reports', href: '/app/reports' },
  { key: 'inbox', href: '/app/inbox' },
  { key: 'settings', href: '/app/settings' },
] as const;

/** Five tabs on phones (docs/05-ux.md §2). The rest live in the sidebar on larger screens. */
const MOBILE_TABS = ['today', 'worship', 'reflection', 'reports', 'settings'] as const;

export function AppNav() {
  const t = useTranslations('nav');
  const tApp = useTranslations('app');
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Sidebar: on the start side (the right in Arabic) */}
      <nav
        aria-label={t('label')}
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-e border-border p-4 md:flex"
      >
        <Link href="/app/today" className="mb-6 flex items-center gap-2 px-3 text-primary">
          <Icon name="sunnah" size={22} />
          <span className="font-display text-2xl font-bold">{tApp('name')}</span>
        </Link>
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            aria-current={isActive(s.href) ? 'page' : undefined}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-muted hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-primary"
          >
            <Icon name={s.key} />
            {t(s.key as 'today')}
          </Link>
        ))}
      </nav>

      {/* Bottom tab bar on phones */}
      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {SECTIONS.filter((s) => (MOBILE_TABS as readonly string[]).includes(s.key)).map((s) => (
          <Link
            key={s.key}
            href={s.href}
            aria-current={isActive(s.href) ? 'page' : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted aria-[current=page]:text-primary"
          >
            <Icon name={s.key} size={22} />
            {t(s.key as 'today')}
          </Link>
        ))}
      </nav>
    </>
  );
}
