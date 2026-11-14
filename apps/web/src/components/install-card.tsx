'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  canPromptInstall,
  isIos,
  isStandalone,
  onInstallChange,
  promptInstall,
} from '@/lib/install';
import { Button, Card } from './ui/primitives';

/** Offers installation where the browser supports it, and Home Screen guidance on iPhone. */
export function InstallCard() {
  const t = useTranslations('settings');
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden');

  useEffect(() => {
    const update = () =>
      setMode(
        isStandalone() ? 'hidden' : canPromptInstall() ? 'prompt' : isIos() ? 'ios' : 'hidden',
      );
    update();
    return onInstallChange(update);
  }, []);

  if (mode === 'hidden') return null;
  return (
    <Card title={t('installTitle')}>
      <p className="mb-4 text-sm text-muted">{t('installBody')}</p>
      {mode === 'prompt' ? (
        <Button onClick={() => void promptInstall()}>{t('installButton')}</Button>
      ) : (
        <p className="text-sm">{t('installIos')}</p>
      )}
    </Card>
  );
}
