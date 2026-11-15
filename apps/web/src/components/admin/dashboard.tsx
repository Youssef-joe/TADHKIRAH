'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, errorKey } from '@/lib/api';
import { Button, Card, Status } from '../ui/primitives';
import { STATUSES, TYPES, type AdminType } from './shared';
import { StatusBadge } from './status-badge';

type Counts = Record<AdminType, Record<string, number>>;

export function AdminDashboard({
  roles,
  twoPersonRule,
}: {
  roles: string[];
  twoPersonRule: boolean;
}) {
  const t = useTranslations('admin');
  const te = useTranslations('errors');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const out = {} as Counts;
    for (const type of TYPES) {
      const rows = await api<{ status: string }[]>(`/admin/${type}`);
      out[type] = rows.reduce<Record<string, number>>(
        (m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }),
        {},
      );
    }
    setCounts(out);
  }
  useEffect(() => {
    void load();
  }, []);

  async function importCandidates() {
    setBusy(true);
    try {
      const r = await api<{ created: number; skipped: number }>('/admin/import-candidates', {
        method: 'POST',
      });
      setStatus({ tone: 'ok', text: t('imported', { created: r.created, skipped: r.skipped }) });
      await load();
    } catch (err) {
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        {t('policyBanner')}
      </p>
      {!twoPersonRule && (
        <p className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm text-accent">
          {t('singleReviewerOn')}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {TYPES.map((type) => (
          <Card key={type} title={t(`nav_${type}`)}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {STATUSES.filter((s) => counts?.[type]?.[s]).map((s) => (
                <li key={s}>
                  <Link
                    href={`/admin/${type}?status=${s}`}
                    className="flex items-center justify-between gap-2 hover:text-primary"
                  >
                    <StatusBadge status={s} />
                    <span className="tabular-nums">{counts![type][s]}</span>
                  </Link>
                </li>
              ))}
              {counts && !Object.keys(counts[type]).length && (
                <li className="text-muted">{t('empty')}</li>
              )}
            </ul>
          </Card>
        ))}
      </div>
      {roles.includes('admin') && (
        <Card title={t('importTitle')}>
          <p className="mb-4 text-sm text-muted">{t('importBody')}</p>
          <Button variant="ghost" onClick={importCandidates} disabled={busy}>
            {t('importButton')}
          </Button>
          {status && <Status tone={status.tone}>{status.text}</Status>}
        </Card>
      )}
    </div>
  );
}
