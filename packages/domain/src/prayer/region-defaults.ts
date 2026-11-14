import type { CalculationMethodKey } from './prayer-times.js';

/**
 * Suggested calculation method by ISO 3166-1 alpha-2 country code. This is only
 * an onboarding suggestion; the user can always change it (ADR-002).
 */
const BY_COUNTRY: Record<string, CalculationMethodKey> = {
  SA: 'UmmAlQura',
  AE: 'Dubai',
  QA: 'Qatar',
  KW: 'Kuwait',
  BH: 'UmmAlQura',
  OM: 'UmmAlQura',
  YE: 'UmmAlQura',
  EG: 'Egyptian',
  JO: 'Egyptian',
  PS: 'Egyptian',
  LB: 'Egyptian',
  SY: 'Egyptian',
  IQ: 'Egyptian',
  SD: 'Egyptian',
  LY: 'Egyptian',
  TR: 'Turkey',
  PK: 'Karachi',
  US: 'NorthAmerica',
  CA: 'NorthAmerica',
  SG: 'Singapore',
};

export function suggestedMethod(countryCode: string | undefined): CalculationMethodKey {
  return (countryCode && BY_COUNTRY[countryCode.toUpperCase()]) || 'MuslimWorldLeague';
}
