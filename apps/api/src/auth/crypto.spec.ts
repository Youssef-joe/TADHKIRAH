import { deviceLabelFromUserAgent, hmac, randomCode, randomToken, safeEqual } from './crypto.js';

describe('auth crypto', () => {
  it('generates 6-digit codes and 256-bit URL-safe tokens', () => {
    for (let i = 0; i < 200; i++) expect(randomCode()).toMatch(/^\d{6}$/);
    expect(randomToken()).toMatch(/^[\w-]{43}$/);
  });

  it('separates HMACs by purpose so values cannot be swapped between uses', () => {
    expect(safeEqual(hmac('k', 'session', 'v'), hmac('k', 'session', 'v'))).toBe(true);
    expect(safeEqual(hmac('k', 'session', 'v'), hmac('k', 'magic', 'v'))).toBe(false);
    expect(safeEqual(hmac('k', 'session', 'v'), Buffer.from('short'))).toBe(false);
  });

  it('derives short device labels without storing the user agent', () => {
    expect(
      deviceLabelFromUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/140.0 Safari/537'),
    ).toBe('Chrome · Windows');
    expect(deviceLabelFromUserAgent(undefined)).toBeNull();
    expect(deviceLabelFromUserAgent('curl/8.0')).toBeNull();
  });
});
