import { SESSION_COOKIE } from '@tadhkirah/contracts';
import type { CookieOptions } from 'express';
import { isSecureDeployment, type Env } from '../config/env.js';

export const SESSION_SLIDING_MS = 30 * 24 * 3600 * 1000;
export const SESSION_ABSOLUTE_MS = 90 * 24 * 3600 * 1000;

/**
 * Over HTTPS the cookie uses the `__Host-` prefix: the browser then requires
 * Secure and Path=/ and forbids a Domain attribute, so subdomains can't plant or
 * read it.
 */
export function sessionCookieName(env: Env): string {
  return isSecureDeployment(env) ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE;
}

export function sessionCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureDeployment(env),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_ABSOLUTE_MS,
  };
}
