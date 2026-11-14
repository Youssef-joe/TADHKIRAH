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

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
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
