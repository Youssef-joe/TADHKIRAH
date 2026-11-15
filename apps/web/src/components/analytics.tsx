'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

/** Signed-in areas and sign-in steps: never measured (PRD §6: no analytics on authenticated pages). */
const PRIVATE = /^\/(ar|en)\/(app|admin|onboarding|verify|goodbye)(\/|$)/;

/**
 * Vercel Web Analytics on public pages only: cookieless page-view counts, no
 * personal data. Only the path is reported; query strings and fragments are dropped.
 */
function pathOnly(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (PRIVATE.test(url.pathname)) return null;
  return { ...event, url: `${url.origin}${url.pathname}` };
}

export function PrivateAnalytics() {
  return <Analytics beforeSend={pathOnly} />;
}
