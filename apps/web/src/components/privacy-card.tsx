'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, errorKey } from '@/lib/api';
import { useMe } from './me-context';
import { Button, Card, Field, Input, Status } from './ui/primitives';

/** Export (ACC-5) and account deletion (ACC-6). */
export function PrivacyCard() {
  const t = useTranslations('settings');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirm.trim().toLowerCase() === me.email.toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/me/delete', { method: 'POST', body: { confirmEmail: confirm } });
      window.location.assign(`/${locale}/goodbye`);
    } catch (err) {
      setError(te(errorKey(err)));
      setBusy(false);
    }
  }

  const link =
    'inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 font-medium hover:bg-bg';
  return (
    <Card title={t('privacy')}>
      <p className="mb-5 text-sm text-muted">{t('privacyBody')}</p>

      <h3 className="font-medium">{t('exportTitle')}</h3>
      <p className="mb-3 text-sm text-muted">{t('exportHint')}</p>
      <div className="flex flex-wrap gap-3">
        <a className={link} href="/v1/me/export?format=md" download>
          {t('exportMd')}
        </a>
        <a className={link} href="/v1/me/export?format=json" download>
          {t('exportJson')}
        </a>
      </div>

      <h3 className="mt-8 font-medium text-danger">{t('deleteTitle')}</h3>
      <p className="mb-3 text-sm text-muted">{t('deleteBody')}</p>
      {!open ? (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          {t('deleteStart')}
        </Button>
      ) : (
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-lg border border-danger/40 p-4"
        >
          <p className="text-sm">{t('deleteSuggestExport')}</p>
          <Field
            label={
              t('deleteConfirmLabel', {
                email: `\u2068${me.email}\u2069`,
              }) /* isolate: keep the LTR email whole in RTL text */
            }
            htmlFor="confirmEmail"
          >
            <Input
              id="confirmEmail"
              type="email"
              dir="ltr"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="danger" disabled={!matches || busy} className="self-start">
            {busy ? t('deleting') : t('deleteButton')}
          </Button>
          {error && <Status tone="error">{error}</Status>}
        </form>
      )}
    </Card>
  );
}
