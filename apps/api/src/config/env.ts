import { z } from 'zod';

const csv = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

/** Optional setting where an empty value (e.g. an unset docker-compose variable) means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

/** Every runtime setting, checked once at boot. The process refuses to start if any is invalid. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    MODE: z.enum(['api', 'worker']).default('api'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    APP_VERSION: z.string().default('dev'),
    /** Origins allowed to make credentialed / state-changing requests. */
    WEB_ORIGINS: csv('http://localhost:3000'),
    /** Public URL of the web app, used for links in emails. */
    PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
    /** Key for HMACs of tokens, codes and sessions. At least 32 characters; rotating it signs everyone out. */
    AUTH_SECRET: z.string().min(32),
    /** Express `trust proxy`. The default trusts private-network hops (Docker, Traefik, Next.js). */
    TRUST_PROXY: z.string().default('loopback, linklocal, uniquelocal'),
    /** `smtp` for real email, `log` prints emails to the log (dev), `memory` keeps them for tests. */
    MAIL_TRANSPORT: z.enum(['smtp', 'log', 'memory']).default('smtp'),
    SMTP_URL: z.string().default('smtp://localhost:1025'),
    MAIL_FROM: z.string().default('Tadhkirah <no-reply@localhost>'),
    /** Only for running production images locally over http (infra/compose.local.yml). */
    ALLOW_INSECURE_HTTP: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /**
     * Master key for envelope encryption of reflections (Architecture §7): 32
     * random bytes, base64 (`openssl rand -base64 32`). KEEP AN OFFLINE COPY:
     * if it's lost, every reflection becomes unreadable.
     */
    MASTER_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes, base64-encoded'),
    MASTER_KEY_VERSION: z.string().default('v1'),
    /** Web Push VAPID keys (npx web-push generate-vapid-keys). Without them, reminders go to the in-app inbox only. */
    VAPID_PUBLIC_KEY: optional(z.string().min(20)),
    VAPID_PRIVATE_KEY: optional(z.string().min(20)),
    /** Contact for push services: a mailto: or https: URL. Defaults to PUBLIC_WEB_URL. */
    VAPID_SUBJECT: optional(z.string()),
    /** `memory` records pushes for tests. */
    PUSH_TRANSPORT: z.enum(['webpush', 'memory']).default('webpush'),
    /** ADR-003: verified users with these emails get admin, editor, reviewer and publisher on sign-in. */
    BOOTSTRAP_ADMIN_EMAILS: csv(''),
    /** ADR-003: reviewer ≠ author. A team of one may set false; such approvals are flagged. */
    CONTENT_TWO_PERSON_RULE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /** Shared secret for scheduled jobs (Vercel Cron sends it as `Authorization: Bearer …`). */
    CRON_SECRET: optional(z.string().min(16)),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.MAIL_TRANSPORT !== 'smtp') {
        ctx.addIssue({
          code: 'custom',
          path: ['MAIL_TRANSPORT'],
          message: 'must be smtp in production',
        });
      }
      if (!env.PUBLIC_WEB_URL.startsWith('https://') && !env.ALLOW_INSECURE_HTTP) {
        ctx.addIssue({
          code: 'custom',
          path: ['PUBLIC_WEB_URL'],
          message: 'must be https in production',
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Fills in defaults from the hosting platform, so a Vercel deployment needs only
 * DATABASE_URL, AUTH_SECRET and an email key. Explicit variables always win.
 * Self-hosted (Coolify / Docker) deployments set everything explicitly.
 */
export function withPlatformDefaults(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...source };
  if (env.VERCEL) {
    const https = (host?: string) => (host ? `https://${host}` : undefined);
    const production = https(env.VERCEL_PROJECT_PRODUCTION_URL);
    const deployment = https(env.VERCEL_URL);
    const branch = https(env.VERCEL_BRANCH_URL);
    // Emails link to the production domain in production, otherwise to this preview.
    env.PUBLIC_WEB_URL ??= env.VERCEL_ENV === 'production' ? production : (branch ?? deployment);
    // Accept requests from every URL that serves this deployment.
    env.WEB_ORIGINS ??= [
      ...new Set([env.PUBLIC_WEB_URL, production, deployment, branch].filter(Boolean)),
    ].join(',');
    // Vercel's edge sets X-Forwarded-For to the real client IP and drops client-supplied values.
    env.TRUST_PROXY ??= 'true';
    // Fluid Compute reuses instances; keep each instance's pool small (Neon pools on its side).
    env.DATABASE_POOL_MAX ??= '3';
  }
  // Resend (Vercel Marketplace) works through our SMTP mailer with just its API key.
  if (!env.SMTP_URL && env.RESEND_API_KEY) {
    env.SMTP_URL = `smtps://resend:${encodeURIComponent(env.RESEND_API_KEY)}@smtp.resend.com:465`;
    // Resend's shared test sender only delivers to the account owner, until a domain is verified.
    env.MAIL_FROM ??= 'Tadhkirah <onboarding@resend.dev>';
  }
  return env;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(withPlatformDefaults(source));
  if (!parsed.success) {
    // Print only field names and messages, never values (they may be secrets).
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Secure cookies (and the `__Host-` prefix) whenever the app is served over HTTPS. */
export function isSecureDeployment(env: Env): boolean {
  return env.PUBLIC_WEB_URL.startsWith('https://');
}
