'use client';

import { useTranslations } from 'next-intl';
import type { ActivityDto } from '@/lib/worship-types';

/** Display name: translated for built-in activities, the user's own text for custom ones. */
export function useActivityName() {
  const t = useTranslations('worship.activities');
  return (a: Pick<ActivityDto, 'catalogKey' | 'name'>) =>
    a.catalogKey ? t(a.catalogKey as 'fajr') : (a.name ?? '');
}

export function numberFormatter(locale: string, digits: 'arab' | 'latn') {
  const nf = new Intl.NumberFormat(`${locale}-u-nu-${digits}`);
  return (n: number) => nf.format(n);
}
