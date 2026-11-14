'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { EmailVerifyResponse } from '@tadhkirah/contracts';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

/**
 * Magic-link landing page. The token is in the URL fragment (#token=…), which
 * never reaches any server or log. We read it here, remove it from the address
 * bar, and exchange it for a session.
 */
export default function VerifyPage() {
  const t = useTranslations('verify');
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setFailed(true);
      return;
    }
    api<EmailVerifyResponse>('/auth/email/verify', {
      method: 'POST',
      body: { token, locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    })
      .then((res) => window.location.replace(`/${res.locale}/app/today`))
      .catch(() => setFailed(true));
  }, [locale]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {failed ? (
        <>
          <p role="alert">{t('failed')}</p>
          <Link href="/sign-in" className="text-primary underline underline-offset-4">
            {t('backToSignIn')}
          </Link>
        </>
      ) : (
        <p role="status" className="text-muted">
          {t('verifying')}
        </p>
      )}
    </main>
  );
}
