import { schema, sql, withSystem, type Database } from '@tadhkirah/db';

const { emailTokens, rateLimits, sessions, scheduledReminders, notificationLog, users } = schema;

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
  // Backstop for account deletion: the request hard-deletes at once; this retries any that failed.
  const deletedUsers = await db
    .delete(users)
    .where(sql`${users.status} = 'pending_deletion'`)
    .returning({ id: users.id });
  // Reminder history: planned rows 30 days after firing, the inbox after 90 days.
  const reminders = await withSystem(db, async (tx) => {
    const sr = await tx
      .delete(scheduledReminders)
      .where(sql`${scheduledReminders.fireAt} < now() - interval '30 days'`)
      .returning({ id: scheduledReminders.id });
    const nl = await tx
      .delete(notificationLog)
      .where(sql`${notificationLog.sentAt} < now() - interval '90 days'`)
      .returning({ id: notificationLog.id });
    return { scheduled: sr.length, inbox: nl.length };
  });
  return {
    deletedAccounts: deletedUsers.length,
    emailTokens: tokens.length,
    rateLimits: limits.length,
    sessions: oldSessions.length,
    scheduledReminders: reminders.scheduled,
    notifications: reminders.inbox,
  };
}
