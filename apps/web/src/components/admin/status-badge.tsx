'use client';

import { useTranslations } from 'next-intl';
import { STATUS_STYLE } from './shared';

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin');
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ''}`}
    >
      {t(`status_${status}` as 'status_draft')}
    </span>
  );
}
