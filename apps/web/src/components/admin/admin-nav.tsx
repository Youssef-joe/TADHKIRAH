'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export function AdminNav({ roles }: { roles: string[] }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const items = [
    { href: '/admin', key: 'nav_dashboard' },
    { href: '/admin/hadiths', key: 'nav_hadiths' },
    { href: '/admin/sunnahs', key: 'nav_sunnahs' },
    { href: '/admin/occasions', key: 'nav_occasions' },
    ...(roles.some((r) => r !== 'editor')
      ? [
          { href: '/admin/review', key: 'nav_review' },
          { href: '/admin/reports', key: 'nav_reports' },
        ]
      : []),
    ...(roles.includes('admin') ? [{ href: '/admin/team', key: 'nav_team' }] : []),
  ] as const;
  const active = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href);
  return (
    <nav
      aria-label={t('title')}
      className="flex flex-wrap items-center gap-1 border-b border-border pb-3"
    >
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i.href) ? 'page' : undefined}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-primary"
        >
          {t(i.key)}
        </Link>
      ))}
      <Link
        href="/app/settings"
        className="ms-auto px-3 py-2 text-sm text-muted hover:text-primary"
      >
        {t('backToApp')}
      </Link>
    </nav>
  );
}
