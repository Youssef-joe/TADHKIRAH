import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, schema, scopeToUser, sql, type DbHandle } from '@tadhkirah/db';
import { AppError } from '../common/http.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { DB } from '../db/db.module.js';

const { users, sessions, userKeys } = schema;

/** Account deletion (ACC-6, AC-DEL). */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * 1. In one transaction: mark the account for deletion, revoke every session,
   *    and destroy the data key (crypto-shred), so encrypted text is unreadable from now on.
   * 2. Hard-delete the user. Every app.* row cascades from auth.users. If this step
   *    fails, the purge job retries it; the account can no longer be used either way.
   */
  async deleteAccount(userId: string, confirmEmail: string): Promise<void> {
    const [user] = await this.handle.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new AppError(404, 'not_found');
    if (user.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      throw new AppError(422, 'privacy.confirm_mismatch', "That email doesn't match your account.");
    }

    await this.handle.db.transaction(async (tx) => {
      // auth.* first, as the owner role; then switch to the user's role for app.* (RLS).
      await tx
        .update(users)
        .set({ status: 'pending_deletion', deletionRequestedAt: sql`now()` })
        .where(eq(users.id, userId));
      await tx
        .update(sessions)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      await scopeToUser(tx, userId);
      await tx.delete(userKeys).where(eq(userKeys.userId, userId));
    });
    this.crypto.forget(userId);

    try {
      await this.handle.db.delete(users).where(eq(users.id, userId));
    } catch (err) {
      this.logger.error({ err }, 'hard delete failed; the purge job will retry');
    }
  }
}
