import { z } from 'zod';
import { LocaleSchema } from './common.js';

/** Trimmed and lowercased before it reaches the database. */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown IANA time zone');

export const EmailStartRequestSchema = z.object({
  email: EmailSchema,
  locale: LocaleSchema.default('ar'),
});
export type EmailStartRequest = z.infer<typeof EmailStartRequestSchema>;

const ClientInfo = {
  client: z.enum(['web', 'mobile']).default('web'),
  deviceLabel: z.string().trim().max(80).optional(),
  /** Used only when this sign-in creates the account. */
  locale: LocaleSchema.optional(),
  timeZone: TimeZoneSchema.optional(),
};

export const EmailVerifyRequestSchema = z.union([
  z.object({ token: z.string().min(20).max(200), ...ClientInfo }),
  z.object({ email: EmailSchema, code: z.string().regex(/^\d{6}$/), ...ClientInfo }),
]);
export type EmailVerifyRequest = z.infer<typeof EmailVerifyRequestSchema>;

export const AuthUserSchema = z.object({ id: z.uuid(), email: z.string() });

export const EmailVerifyResponseSchema = z.object({
  user: AuthUserSchema,
  isNew: z.boolean(),
  locale: LocaleSchema,
  /** Mobile clients only: bearer token. Web clients get an httpOnly cookie instead. */
  accessToken: z.string().optional(),
});
export type EmailVerifyResponse = z.infer<typeof EmailVerifyResponseSchema>;

export const SessionSchema = z.object({
  id: z.uuid(),
  deviceLabel: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  current: z.boolean(),
});
export type SessionInfo = z.infer<typeof SessionSchema>;

/**
 * Header required on state-changing requests that authenticate with the session
 * cookie. Cross-site pages can't set custom headers without passing our CORS check.
 */
export const CSRF_HEADER = 'x-tadhkirah-csrf';
export const SESSION_COOKIE = 'tadhkirah_session';
