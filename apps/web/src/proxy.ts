import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18n = createMiddleware(routing);

/**
 * Content-Security-Policy with a fresh nonce per request (M8). Next.js reads the
 * nonce from the request's CSP header and puts it on its own scripts; anything
 * those scripts load (e.g. Vercel Analytics) is allowed through 'strict-dynamic'.
 * Every page is rendered per request, so each gets its own nonce.
 */
function contentSecurityPolicy(nonce: string, https: boolean): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    // React sets inline style attributes (e.g. the sky's colours).
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export default function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, request.nextUrl.protocol === 'https:');
  request.headers.set('Content-Security-Policy', csp);
  request.headers.set('x-nonce', nonce);
  const response = handleI18n(request);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Skip the API (/v1), Next internals, health checks and static files.
  matcher: '/((?!v1|healthz|_next|_vercel|.*\\..*).*)',
};
