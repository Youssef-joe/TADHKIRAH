import { loadEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  AUTH_SECRET: 'x'.repeat(32),
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
