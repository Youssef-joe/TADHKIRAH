'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card } from './ui/primitives';

/** Shown only to people with an editorial role (ADR-003). */
export function ReviewDeskCard() {
  const t = useTranslations('admin');
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    api<{ roles: string[] }>('/admin/me').then(
      (r) => setRoles(r.roles),
      () => undefined,
    );
  }, []);
  if (!roles.length) return null;
  return (
    <Card title={t('deskLink')}>
      <p className="mb-4 text-sm text-muted">{t('deskLinkBody')}</p>
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-white hover:opacity-90"
      >
        {t('deskLink')}
      </Link>
    </Card>
  );
}
