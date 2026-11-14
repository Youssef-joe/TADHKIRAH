import { schema, sql, type Database } from '@tadhkirah/db';

const { emailTokens, rateLimits, sessions } = schema;

/**
 * Deletes records past their retention period (docs/03-data-model.md §5).
 * Safe to run any number of times.
 */
export async function purgeExpired(db: Database): Promise<Record<string, number>> {
  const tokens = await db
    .delete(emailTokens)
    .where(sql`${emailTokens.createdAt} < now() - interval '24 hours'`)
    .returning({ id: emailTokens.id });
  const limits = await db
    .delete(rateLimits)
    .where(sql`${rateLimits.windowStart} < now() - interval '1 day'`)
    .returning({ key: rateLimits.key });
  const oldSessions = await db
    .delete(sessions)
    .where(
      sql`coalesce(${sessions.revokedAt}, least(${sessions.expiresAt}, ${sessions.absoluteExpiresAt})) < now() - interval '90 days'`,
    )
    .returning({ id: sessions.id });
  return { emailTokens: tokens.length, rateLimits: limits.length, sessions: oldSessions.length };
}
