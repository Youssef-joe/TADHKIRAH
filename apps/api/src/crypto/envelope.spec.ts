import { randomBytes } from 'node:crypto';
import { open, parseMasterKey, seal } from './envelope.js';

describe('envelope encryption (AES-256-GCM)', () => {
  const key = randomBytes(32);

  it('round-trips Arabic text and never contains the plaintext', () => {
    const text = 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ';
    const blob = seal(key, text, 'u1|reflection|intention|2026-11-14');
    expect(blob.includes(Buffer.from(text))).toBe(false);
    expect(open(key, blob, 'u1|reflection|intention|2026-11-14').toString('utf8')).toBe(text);
  });

  it('uses a fresh IV each time (same text → different ciphertext)', () => {
    expect(seal(key, 'x', 'a').equals(seal(key, 'x', 'a'))).toBe(false);
  });

  it('refuses ciphertext moved to another user, field or record (AAD binding)', () => {
    const blob = seal(key, 'secret', 'u1|reflection|intention|2026-11-14');
    expect(() => open(key, blob, 'u2|reflection|intention|2026-11-14')).toThrow();
    expect(() => open(key, blob, 'u1|reflection|shortcoming|2026-11-14')).toThrow();
  });

  it('detects tampering and wrong keys', () => {
    const blob = seal(key, 'secret', 'aad');
    const tampered = Buffer.from(blob);
    tampered[20] = (tampered[20] ?? 0) ^ 0xff;
    expect(() => open(key, tampered, 'aad')).toThrow();
    expect(() => open(randomBytes(32), blob, 'aad')).toThrow();
  });

  it('validates master keys', () => {
    expect(parseMasterKey(randomBytes(32).toString('base64'))).toHaveLength(32);
    expect(() => parseMasterKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
  });
});
