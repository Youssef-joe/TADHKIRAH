'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { api, errorKey } from '@/lib/api';
import { Button, Card, Field, Input, Select, Status } from '../ui/primitives';
import { adminErrorKey } from './shared';

type Member = { userId: string; email: string; roles: string[] };
const ROLES = ['editor', 'reviewer', 'publisher', 'admin'] as const;

/** ADR-003: the admin appoints editors, reviewers and publishers; every change is audited. */
export function AdminTeam() {
  const t = useTranslations('admin');
  const te = useTranslations('errors');
  const [team, setTeam] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('reviewer');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = () => api<Member[]>('/admin/team').then(setTeam, () => undefined);
  useEffect(() => {
    void load();
  }, []);

  async function change(target: string, r: string, grant: boolean) {
    setStatus(null);
    try {
      await api('/admin/team', { method: 'PUT', body: { email: target, role: r, grant } });
      setStatus({ tone: 'ok', text: t('saved') });
      await load();
    } catch (err) {
      const k = adminErrorKey(err);
      setStatus({ tone: 'error', text: k ? t(k as 'err_forbidden') : te(errorKey(err)) });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title={t('nav_team')}>
        <p className="mb-4 text-sm text-muted">{t('teamIntro')}</p>
        <ul className="flex flex-col divide-y divide-border">
          {team.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-2 py-3">
              <bdi dir="ltr" className="me-auto">
                {m.email}
              </bdi>
              {m.roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  title={t('revoke')}
                  onClick={() => change(m.email, r, false)}
                  className="rounded-full border border-border px-2 py-0.5 text-xs hover:border-danger hover:text-danger"
                >
                  {t(`role_${r}` as 'role_admin')} ×
                </button>
              ))}
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t('grant')}>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void change(email.trim(), role, true);
          }}
        >
          <Field label={t('email')} htmlFor="team-email">
            <Input
              id="team-email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t('role')} htmlFor="team-role">
            <Select
              id="team-role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role_${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">{t('grant')}</Button>
        </form>
        {status && <Status tone={status.tone}>{status.text}</Status>}
      </Card>
    </div>
  );
}
