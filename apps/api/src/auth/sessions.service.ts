import { Inject, Injectable } from '@nestjs/common';
import type { SessionInfo } from '@tadhkirah/contracts';
import { and, desc, eq, gt, isNull, schema, sql, type DbHandle } from '@tadhkirah/db';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';
import { hmac, randomToken } from './crypto.js';
import { SESSION_ABSOLUTE_MS, SESSION_SLIDING_MS } from './session-cookie.js';

const { sessions, users } = schema;

/** Refresh last-seen (and slide the expiry) at most once an hour per session. */
const TOUCH_INTERVAL_MS = 3600 * 1000;

export interface ResolvedSession {
  sessionId: string;
  userId: string;
}

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Creates a session and returns the raw token. It is shown once and never stored. */
  async create(
    userId: string,
    kind: 'cookie' | 'bearer',
    deviceLabel: string | null,
  ): Promise<{ token: string; sessionId: string }> {
    const token = randomToken();
    const now = Date.now();
    const [row] = await this.handle.db
      .insert(sessions)
      .values({
        userId,
        kind,
        deviceLabel,
        tokenHash: hmac(this.env.AUTH_SECRET, 'session', token),
        expiresAt: new Date(now + SESSION_SLIDING_MS),
        absoluteExpiresAt: new Date(now + SESSION_ABSOLUTE_MS),
      })
      .returning({ id: sessions.id });
    return { token, sessionId: row!.id };
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    const now = new Date();
    const [row] = await this.handle.db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        lastSeenAt: sessions.lastSeenAt,
        absoluteExpiresAt: sessions.absoluteExpiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, hmac(this.env.AUTH_SECRET, 'session', token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          gt(sessions.absoluteExpiresAt, now),
          eq(users.status, 'active'),
        ),
      )
      .limit(1);
    if (!row) return null;

    if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      const slid = Math.min(now.getTime() + SESSION_SLIDING_MS, row.absoluteExpiresAt.getTime());
      await this.handle.db
        .update(sessions)
        .set({ lastSeenAt: now, expiresAt: new Date(slid) })
        .where(eq(sessions.id, row.sessionId));
    }
    return { sessionId: row.sessionId, userId: row.userId };
  }

  async list(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const now = new Date();
    const rows = await this.handle.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      )
      .orderBy(desc(sessions.lastSeenAt));
    return rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  /** Revokes one of the user's own sessions. Returns false if it wasn't theirs or was already revoked. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const rows = await this.handle.db
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)),
      )
      .returning({ id: sessions.id });
    return rows.length > 0;
  }
}
