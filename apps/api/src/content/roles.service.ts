import { Inject, Injectable } from '@nestjs/common';
import type { EditorialRole } from '@tadhkirah/contracts';
import { and, eq, schema, sql, type DbHandle } from '@tadhkirah/db';
import { AppError } from '../common/http.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';

const { users, userRoles, roleAudit, sessions } = schema;
const ALL: EditorialRole[] = ['admin', 'editor', 'reviewer', 'publisher'];
/** ADR-003: workflow transitions need a sign-in less than 12 hours old. */
const FRESH_SESSION_MS = 12 * 3_600_000;

/** Editorial roles (ADR-003): granted by an admin, logged in an append-only audit. */
@Injectable()
export class RolesService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** The user's roles. The bootstrap admin gets every role on first use (idempotent, audited). */
  async rolesOf(userId: string): Promise<EditorialRole[]> {
    const rows = await this.handle.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    if (rows.length) return rows.map((r) => r.role);
    if (!this.env.BOOTSTRAP_ADMIN_EMAILS.length) return [];
    const [u] = await this.handle.db
      .select({ email: users.email, verified: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId));
    const bootstrap = this.env.BOOTSTRAP_ADMIN_EMAILS.map((e) => e.toLowerCase());
    if (!u?.verified || !bootstrap.includes(u.email.toLowerCase())) return [];
    await this.handle.db.transaction(async (tx) => {
      for (const role of ALL) {
        const [added] = await tx
          .insert(userRoles)
          .values({ userId, role })
          .onConflictDoNothing()
          .returning();
        if (added)
          await tx
            .insert(roleAudit)
            .values({ userId, role, action: 'grant_bootstrap', actorUserId: null });
      }
    });
    return ALL;
  }

  async require(userId: string, ...anyOf: EditorialRole[]): Promise<EditorialRole[]> {
    const roles = await this.rolesOf(userId);
    if (!anyOf.some((r) => roles.includes(r)))
      throw new AppError(403, 'forbidden', 'This needs an editorial role.');
    return roles;
  }

  async requireFreshSession(sessionId: string): Promise<void> {
    const [s] = await this.handle.db
      .select({ createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!s || Date.now() - s.createdAt.getTime() > FRESH_SESSION_MS) {
      throw new AppError(403, 'content.session_too_old', 'Please sign in again to review content.');
    }
  }

  async team() {
    const rows = await this.handle.db
      .select({
        userId: userRoles.userId,
        email: users.email,
        role: userRoles.role,
        grantedAt: userRoles.grantedAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .orderBy(users.email);
    const byUser = new Map<string, { userId: string; email: string; roles: EditorialRole[] }>();
    for (const r of rows) {
      const entry = byUser.get(r.userId) ?? { userId: r.userId, email: r.email, roles: [] };
      entry.roles.push(r.role);
      byUser.set(r.userId, entry);
    }
    return [...byUser.values()];
  }

  /** Grants or revokes a role for an existing account (by email). */
  async change(actorId: string, email: string, role: EditorialRole, grant: boolean): Promise<void> {
    const [u] = await this.handle.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(sql`lower(${users.email})`, email.toLowerCase()), eq(users.status, 'active')));
    if (!u)
      throw new AppError(
        404,
        'content.user_not_found',
        'No account uses that email. Ask them to sign in once first.',
      );
    if (!grant && role === 'admin' && u.id === actorId) {
      throw new AppError(
        422,
        'content.cannot_revoke_own_admin',
        "You can't remove your own admin role.",
      );
    }
    await this.handle.db.transaction(async (tx) => {
      const changed = grant
        ? await tx
            .insert(userRoles)
            .values({ userId: u.id, role, grantedBy: actorId })
            .onConflictDoNothing()
            .returning()
        : await tx
            .delete(userRoles)
            .where(and(eq(userRoles.userId, u.id), eq(userRoles.role, role)))
            .returning();
      if (changed.length)
        await tx
          .insert(roleAudit)
          .values({ userId: u.id, role, action: grant ? 'grant' : 'revoke', actorUserId: actorId });
    });
  }
}
