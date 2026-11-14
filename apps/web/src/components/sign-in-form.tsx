'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { EmailVerifyResponse } from '@tadhkirah/contracts';
import { api, errorKey } from '@/lib/api';
import { Button, Field, Input, Status } from './ui/primitives';

/** Two steps: email → 6-digit code. The emailed magic link is an alternative to the code. */
export function SignInForm() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const locale = useLocale() as 'ar' | 'en';
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api('/auth/email/start', { method: 'POST', body: { email, locale } });
      if (step === 'code') setNotice(t('resent'));
      setStep('code');
    } catch (err) {
      setError(te(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<EmailVerifyResponse>('/auth/email/verify', {
        method: 'POST',
        body: {
          email,
          code,
          locale,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      // Full navigation so server components re-read the new session cookie.
      window.location.assign(`/${res.locale}/app/today`);
    } catch (err) {
      setError(te(errorKey(err)));
      setBusy(false);
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
        <Field label={t('emailLabel')} htmlFor="email">
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && <Status tone="error">{error}</Status>}
        <Button type="submit" disabled={busy || !email.includes('@')}>
          {busy ? t('sending') : t('sendCode')}
        </Button>
        <p className="text-sm text-muted">{t('privacyNote')}</p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <p>
        {t.rich('codeSent', {
          email: () => (
            <bdi dir="ltr" className="font-medium">
              {email}
            </bdi>
          ),
        })}
      </p>
      <Field label={t('codeLabel')} htmlFor="code">
        <Input
          id="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="text-center text-2xl tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </Field>
      {error && <Status tone="error">{error}</Status>}
      {notice && <Status tone="ok">{notice}</Status>}
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? t('verifying') : t('verify')}
      </Button>
      <p className="text-sm text-muted">{t('checkSpam')}</p>
      <div className="flex flex-wrap gap-4">
        <Button type="button" variant="quiet" onClick={() => sendCode()} disabled={busy}>
          {t('resend')}
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
        >
          {t('changeEmail')}
        </Button>
      </div>
    </form>
  );
}
