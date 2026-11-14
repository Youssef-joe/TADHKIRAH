import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults and parses WEB_ORIGINS', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      WEB_ORIGINS: 'https://a.example, https://b.example',
    });
    expect(env.MODE).toBe('api');
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('refuses to start without a valid DATABASE_URL and never prints values', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://secret-password@x' })).toThrow(/DATABASE_URL/);
    try {
      loadEnv({ DATABASE_URL: 'mysql://secret-password@x' });
    } catch (e) {
      expect(String(e)).not.toContain('secret-password');
    }
  });
});
