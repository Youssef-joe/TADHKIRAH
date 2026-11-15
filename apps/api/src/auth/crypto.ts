import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Secrets (session tokens, magic-link tokens, sign-in codes) are never stored.
 * Only their keyed HMAC-SHA256 is stored, so a database leak alone can't be used
 * to sign in. Each purpose uses a different prefix, so one kind of value can't be
 * substituted for another.
 */
export type SecretPurpose = 'session' | 'magic' | 'code' | 'ratelimit' | 'oauth';

export function hmac(secret: string, purpose: SecretPurpose, value: string): Buffer {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest();
}

export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 256-bit URL-safe random token. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Uniformly random 6-digit code (leading zeros allowed). */
export function randomCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** A short, non-identifying label such as "Safari · iPhone", shown in the sessions list. */
export function deviceLabelFromUserAgent(ua: string | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  const label = [browser, os].filter(Boolean).join(' · ');
  return label || null;
}
