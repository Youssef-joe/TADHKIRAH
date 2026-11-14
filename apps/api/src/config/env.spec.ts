import { loadEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  AUTH_SECRET: 'x'.repeat(32),
  MASTER_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('loadEnv', () => {
  it('applies defaults and parses WEB_ORIGINS', () => {
    const env = loadEnv({ ...base, WEB_ORIGINS: 'https://a.example, https://b.example' });
    expect(env.MODE).toBe('api');
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('refuses to start without a valid DATABASE_URL and never prints values', () => {
    const bad = { ...base, DATABASE_URL: 'mysql://secret-password@x' };
    expect(() => loadEnv(bad)).toThrow(/DATABASE_URL/);
    try {
      loadEnv(bad);
    } catch (e) {
      expect(String(e)).not.toContain('secret-password');
    }
  });

  it('requires a 256-bit MASTER_KEY', () => {
    expect(() => loadEnv({ ...base, MASTER_KEY: 'c2hvcnQ=' })).toThrow(/MASTER_KEY/);
  });

  it('requires a long AUTH_SECRET', () => {
    expect(() => loadEnv({ ...base, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
  });

  it('requires https and real SMTP in production, unless explicitly allowed for local testing', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', PUBLIC_WEB_URL: 'http://x.example' }),
    ).toThrow(/PUBLIC_WEB_URL/);
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        PUBLIC_WEB_URL: 'https://x.example',
        MAIL_TRANSPORT: 'log',
      }),
    ).toThrow(/MAIL_TRANSPORT/);
    expect(
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        PUBLIC_WEB_URL: 'http://localhost:3000',
        ALLOW_INSECURE_HTTP: 'true',
      }).ALLOW_INSECURE_HTTP,
    ).toBe(true);
  });
});

describe('withPlatformDefaults (Vercel)', () => {
  const vercel = {
    ...base,
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_PRODUCTION_URL: 'tadhkirah.example',
    VERCEL_URL: 'tadhkirah-abc123.vercel.app',
    VERCEL_BRANCH_URL: 'tadhkirah-git-main.vercel.app',
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_test',
  };

  it('derives URLs, origins, proxy trust and pool size from Vercel variables', () => {
    const env = loadEnv(vercel);
    expect(env.PUBLIC_WEB_URL).toBe('https://tadhkirah.example');
    expect(env.WEB_ORIGINS).toEqual([
      'https://tadhkirah.example',
      'https://tadhkirah-abc123.vercel.app',
      'https://tadhkirah-git-main.vercel.app',
    ]);
    expect(env.TRUST_PROXY).toBe('true');
    expect(env.DATABASE_POOL_MAX).toBe(3);
  });

  it('points previews at their own URL and uses Resend over SMTP', () => {
    const env = loadEnv({ ...vercel, VERCEL_ENV: 'preview' });
    expect(env.PUBLIC_WEB_URL).toBe('https://tadhkirah-git-main.vercel.app');
    expect(env.SMTP_URL).toBe('smtps://resend:re_test@smtp.resend.com:465');
    expect(env.MAIL_FROM).toContain('onboarding@resend.dev');
  });

  it('never overrides explicit settings', () => {
    const env = loadEnv({
      ...vercel,
      PUBLIC_WEB_URL: 'https://custom.example',
      SMTP_URL: 'smtp://x:1',
    });
    expect(env.PUBLIC_WEB_URL).toBe('https://custom.example');
    expect(env.SMTP_URL).toBe('smtp://x:1');
  });
});
