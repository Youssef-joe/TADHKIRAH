import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { eq, schema, type Tx } from '@tadhkirah/db';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { open, parseMasterKey, seal } from './envelope.js';

const { userKeys } = schema;
const CACHE_MS = 5 * 60 * 1000;

/**
 * Envelope encryption for private text (Architecture §7):
 *  - each user has a random 256-bit data key (DEK)
 *  - the DEK is stored only wrapped (encrypted) by the master key (`MASTER_KEY`)
 *  - text is sealed with the DEK, and the AAD binds it to user, table, field and record
 *
 * Unwrapped DEKs live in memory for at most 5 minutes and are never logged.
 * Deleting a user's `user_keys` row makes their reflections unrecoverable.
 * All methods must run inside withUser() (RLS).
 */
@Injectable()
export class CryptoService {
  private readonly master: Buffer;
  private readonly cache = new Map<string, { dek: Buffer; expires: number }>();

  constructor(@Inject(ENV) private readonly env: Env) {
    this.master = parseMasterKey(env.MASTER_KEY);
  }

  private wrapAad(userId: string) {
    return `dek|${userId}`;
  }

  private async dek(tx: Tx, userId: string): Promise<Buffer> {
    const hit = this.cache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.dek;

    const [row] = await tx.select().from(userKeys).where(eq(userKeys.userId, userId));
    let dek: Buffer;
    if (row) {
      dek = open(this.master, row.wrappedDek, this.wrapAad(userId));
    } else {
      dek = randomBytes(32);
      await tx
        .insert(userKeys)
        .values({
          userId,
          wrappedDek: seal(this.master, dek, this.wrapAad(userId)),
          masterKeyVersion: this.env.MASTER_KEY_VERSION,
        })
        .onConflictDoNothing();
      // Another request may have created the key at the same moment: use whichever was stored.
      const [stored] = await tx.select().from(userKeys).where(eq(userKeys.userId, userId));
      dek = open(this.master, stored!.wrappedDek, this.wrapAad(userId));
    }
    this.cache.set(userId, { dek, expires: Date.now() + CACHE_MS });
    return dek;
  }

  async encrypt(
    tx: Tx,
    userId: string,
    context: string,
    text: string | null | undefined,
  ): Promise<Buffer | null> {
    if (text == null || text === '') return null;
    return seal(await this.dek(tx, userId), text, `${userId}|${context}`);
  }

  async decrypt(
    tx: Tx,
    userId: string,
    context: string,
    blob: Buffer | null,
  ): Promise<string | null> {
    if (!blob) return null;
    return open(await this.dek(tx, userId), blob, `${userId}|${context}`).toString('utf8');
  }

  /** Drops the cached key (e.g. after account deletion). */
  forget(userId: string): void {
    this.cache.delete(userId);
  }
}
