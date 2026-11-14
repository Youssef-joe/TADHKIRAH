'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export const SECTIONS = [
  { key: 'today', href: '/app/today', icon: '◐' },
  { key: 'worship', href: '/app/worship', icon: '◇' },
  { key: 'reflection', href: '/app/reflection', icon: '✎' },
  { key: 'sunnah', href: '/app/sunnah', icon: '✦' },
  { key: 'times', href: '/app/times', icon: '☾' },
  { key: 'reports', href: '/app/reports', icon: '▤' },
  { key: 'settings', href: '/app/settings', icon: '⚙' },
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
        <Link href="/app/today" className="mb-6 px-3 text-xl font-semibold text-primary">
          {tApp('name')}
        </Link>
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            aria-current={isActive(s.href) ? 'page' : undefined}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-muted hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-primary"
          >
            <span aria-hidden className="w-5 text-center">
              {s.icon}
            </span>
            {t(s.key)}
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
            <span aria-hidden className="text-lg leading-none">
              {s.icon}
            </span>
            {t(s.key)}
          </Link>
        ))}
      </nav>
    </>
  );
}
