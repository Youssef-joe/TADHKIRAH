'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button, Card } from '../ui/primitives';

type Report = {
  id: string;
  subjectType: string;
  subjectId: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};

export function AdminReports() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [items, setItems] = useState<Report[] | null>(null);
  const load = () => api<Report[]>('/admin/issue-reports').then(setItems, () => setItems([]));
  useEffect(() => {
    void load();
  }, []);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Card title={t('nav_reports')}>
      {items && !items.length && <p className="text-muted">{t('reportsEmpty')}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {items?.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3">
            <p className="text-sm text-muted">
              {fmt.format(new Date(r.createdAt))} · {r.subjectType}
            </p>
            <p className="whitespace-pre-line">{r.message}</p>
            {r.resolvedAt ? (
              <span className="text-sm text-primary">{t('resolved')}</span>
            ) : (
              <Button
                variant="ghost"
                className="self-start"
                onClick={async () => {
                  await api(`/admin/issue-reports/${r.id}/resolve`, { method: 'POST' });
                  await load();
                }}
              >
                {t('resolve')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
