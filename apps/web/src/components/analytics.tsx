'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

/**
 * Vercel Web Analytics: cookieless page-view counts, no personal data.
 * Only the path is reported; query strings and fragments are dropped.
 */
function pathOnly(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  return { ...event, url: `${url.origin}${url.pathname}` };
}

export function PrivateAnalytics() {
  return <Analytics beforeSend={pathOnly} />;
}
