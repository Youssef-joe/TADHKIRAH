'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { OnboardingRequest } from '@tadhkirah/contracts';
import { suggestedMethod } from '@tadhkirah/domain';
import { api, errorKey } from '@/lib/api';
import type { Digits } from '@/lib/format';
import { Icon } from '../ui/icons';
import { Button, Status } from '../ui/primitives';
import { LocationPicker, type PickedLocation } from './location-picker';
import { MethodFields, TimesPreview, type MethodValue } from './method-fields';

/** Two steps: where you pray, then how times are calculated (with a live preview). */
export function OnboardingFlow({ digits }: { digits: Digits }) {
  const t = useTranslations('onboarding');
  const te = useTranslations('errors');
  const locale = useLocale() as 'ar' | 'en';
  const [step, setStep] = useState<1 | 2>(1);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [method, setMethod] = useState<MethodValue>({
    method: 'MuslimWorldLeague',
    asrMethod: 'standard',
    highLatRule: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseLocation(l: PickedLocation) {
    setLocation(l);
    // Suggest the method most used in that country (ADR-002 region defaults).
    setMethod((m) => ({
      ...m,
      method: suggestedMethod(l.countryCode ?? undefined),
      highLatRule: Math.abs(l.latitude) >= 48 ? 'seventh_of_night' : null,
    }));
  }

  async function finish() {
    if (!location) return setError(te('locationRequired'));
    setBusy(true);
    setError(null);
    const { timeZone, ...where } = location;
    const body: OnboardingRequest = {
      locale,
      timezone: timeZone,
      prayerSettings: { ...where, ...method },
    };
    try {
      await api('/me/onboarding', { method: 'POST', body });
      window.location.assign(`/${locale}/app/today`);
    } catch (err) {
      setError(te(errorKey(err)));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3" aria-hidden>
        {[1, 2].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? 'bg-primary' : 'bg-border'}`}
          />
        ))}
      </div>
      <p className="text-sm text-muted">
        {t('step', {
          n: new Intl.NumberFormat(`${locale}-u-nu-${digits}`).format(step),
          total: new Intl.NumberFormat(`${locale}-u-nu-${digits}`).format(2),
        })}
      </p>

      {step === 1 ? (
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Icon name="pin" className="text-primary" /> {t('locationTitle')}
          </h2>
          <p className="text-sm text-muted">{t('locationHint')}</p>
          <LocationPicker value={location} onChange={chooseLocation} />
          <Button className="mt-2 self-end" disabled={!location} onClick={() => setStep(2)}>
            {t('next')} <Icon name="arrow" size={18} flipInRtl />
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Icon name="clock" className="text-primary" /> {t('methodTitle')}
          </h2>
          <p className="text-sm text-muted">{t('methodHint')}</p>
          <MethodFields value={method} onChange={setMethod} latitude={location!.latitude} />
          <TimesPreview
            settings={{ ...location!, ...method }}
            timeZone={location!.timeZone}
            digits={digits}
          />
          {error && <Status tone="error">{error}</Status>}
          <div className="mt-2 flex items-center justify-between gap-3">
            <Button variant="quiet" onClick={() => setStep(1)}>
              {t('back')}
            </Button>
            <Button onClick={finish} disabled={busy}>
              {busy ? t('saving') : t('finish')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
