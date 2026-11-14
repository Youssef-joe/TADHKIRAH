import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM sealing used for reflections and for wrapping per-user keys.
 *
 *   blob = [version:1][iv:12][ciphertext:n][tag:16]
 *
 * The AAD (additional authenticated data) binds a ciphertext to its context
 * (e.g. "user|table|field|record"). Moving it to another user, row or field
 * makes decryption fail instead of silently revealing data.
 */
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

export function seal(key: Buffer, plaintext: Buffer | string, aad: string): Buffer {
  if (key.length !== 32) throw new Error('seal: key must be 32 bytes');
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, body, cipher.getAuthTag()]);
}

export function open(key: Buffer, blob: Buffer, aad: string): Buffer {
  if (key.length !== 32) throw new Error('open: key must be 32 bytes');
  if (blob.length < 1 + IV_LEN + TAG_LEN || blob[0] !== VERSION) {
    throw new Error('open: unsupported ciphertext');
  }
  const iv = blob.subarray(1, 1 + IV_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const body = blob.subarray(1 + IV_LEN, blob.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/** Parses a base64 master key and checks it's exactly 256 bits. */
export function parseMasterKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error('MASTER_KEY must be 32 bytes, base64-encoded');
  return key;
}
