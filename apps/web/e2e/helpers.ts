import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import arMessages from '@tadhkirah/i18n/messages/ar.json' with { type: 'json' };
import enMessages from '@tadhkirah/i18n/messages/en.json' with { type: 'json' };

export type Locale = 'ar' | 'en';
export const LOCALES: Locale[] = ['ar', 'en'];
export const messages = { ar: arMessages, en: enMessages } as const;

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const CSRF = { 'x-tadhkirah-csrf': '1' };

export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** A documentation-range IP per test, so sign-in rate limits never collide between tests. */
export const uniqueIp = () => `203.0.113.${1 + Math.floor(Math.random() * 250)}`;

/** Reads the 6-digit sign-in code that the API emailed to `email`. */
export async function codeFor(request: APIRequestContext, email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const search = await request.get(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages: found } = (await search.json()) as { messages: { ID: string }[] };
    if (found.length) {
      const msg = (await (
        await request.get(`${MAILPIT}/api/v1/message/${found[0]!.ID}`)
      ).json()) as { Text: string };
      const code = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in email for ${email}`);
}

/** Signs in through the API and onboards in Riyadh: for tests that aren't about sign-in. */
export async function signedInContext(
  context: BrowserContext,
  baseURL: string,
  locale: Locale = 'ar',
) {
  const request = context.request;
  const email = uniqueEmail(locale);
  const headers = { ...CSRF, origin: baseURL, 'x-forwarded-for': uniqueIp() };
  expect(
    (await request.post('/v1/auth/email/start', { headers, data: { email, locale } })).status(),
  ).toBe(202);
  const verify = await request.post('/v1/auth/email/verify', {
    headers,
    data: { email, code: await codeFor(request, email), locale, timeZone: 'Asia/Riyadh' },
  });
  expect(verify.status()).toBe(200);
  const onboard = await request.post('/v1/me/onboarding', {
    headers,
    data: {
      timezone: 'Asia/Riyadh',
      locale,
      prayerSettings: {
        latitude: 24.71,
        longitude: 46.68,
        locationLabel: 'Riyadh',
        countryCode: 'SA',
        method: 'UmmAlQura',
      },
    },
  });
  expect(onboard.status()).toBe(204);
  return { email };
}

/** The tracking day according to the server (it starts at Fajr). */
export async function today(page: Page): Promise<string> {
  const res = await page.request.get('/v1/worship/logs?from=2000-01-01&to=2000-01-01');
  return ((await res.json()) as { today: string }).today;
}
