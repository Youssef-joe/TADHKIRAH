import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, schema, sql, withSystem, type DbHandle, type Tx } from '@tadhkirah/db';
import {
  defaultRules,
  planReminders,
  toPrayerLocation,
  type PlanPrefs,
  type ReminderTiming,
  type RuleLike,
} from '@tadhkirah/domain';
import { DB } from '../db/db.module.js';

const {
  users,
  reminderRules,
  scheduledReminders,
  notificationPreferences,
  userProfiles,
  userPreferences,
  prayerTimeSettings,
} = schema;

export const HORIZON_MS = 36 * 3600 * 1000;
const REPLAN_BEFORE_MS = 24 * 3600 * 1000;

/**
 * Expands rules into concrete reminders for the next 36 h (Architecture §8.3).
 * Inserts are ON CONFLICT DO NOTHING on (user, rule, fire_at), so running it
 * any number of times is safe (AC-NOT-idempotent). It works inside either
 * withUser() or withSystem(); both can read this user's rows.
 */
@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /** Creates the default rules on first use. */
  async provision(tx: Tx, userId: string): Promise<void> {
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(reminderRules)
      .where(eq(reminderRules.userId, userId));
    if (n > 0) return;
    const [prefs] = await tx
      .select({ weekStart: userPreferences.weekStart })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    await tx.insert(reminderRules).values(
      defaultRules(prefs?.weekStart ?? 6).map((r) => ({
        userId,
        category: r.category,
        timing: r.timing as unknown as Record<string, unknown>,
        days: r.days,
        enabled: r.enabled,
        allowInQuietHours: r.allowInQuietHours,
      })),
    );
  }

  async planUser(tx: Tx, userId: string, now: Date, reset: boolean): Promise<number> {
    await this.provision(tx, userId);
    if (reset) {
      // Settings changed: drop future planned reminders and plan again.
      await tx
        .delete(scheduledReminders)
        .where(
          and(
            eq(scheduledReminders.userId, userId),
            eq(scheduledReminders.source, 'planned'),
            inArray(scheduledReminders.status, ['pending', 'suppressed']),
            sql`${scheduledReminders.fireAt} > ${now}`,
          ),
        );
    }
    const [profile] = await tx
      .select({ timezone: userProfiles.timezone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    if (!profile) return 0;
    const [settings] = await tx
      .select()
      .from(prayerTimeSettings)
      .where(eq(prayerTimeSettings.userId, userId));
    const [np] = await tx
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    const prefs: PlanPrefs = {
      enabled: np?.enabled ?? true,
      quietStart: np?.quietStart?.slice(0, 5) ?? null,
      quietEnd: np?.quietEnd?.slice(0, 5) ?? null,
      dailyCap: np?.dailyCap ?? 6,
    };
    const rules: RuleLike[] = (
      await tx.select().from(reminderRules).where(eq(reminderRules.userId, userId))
    ).map((r) => ({
      id: r.id,
      category: r.category,
      timing: r.timing as unknown as ReminderTiming,
      days: r.days,
      allowInQuietHours: r.allowInQuietHours,
      enabled: r.enabled,
    }));
    const location = settings
      ? toPrayerLocation(
          {
            latitude: settings.latitude,
            longitude: settings.longitude,
            method: settings.method as Parameters<typeof toPrayerLocation>[0]['method'],
            asrMethod: settings.asrMethod,
            highLatRule: settings.highLatRule,
            adjustments: settings.adjustments,
            jumuahKhutbahTime: settings.jumuahKhutbahTime?.slice(0, 5) ?? null,
          },
          profile.timezone,
        )
      : undefined;

    const planned = planReminders(
      rules,
      now,
      new Date(now.getTime() + HORIZON_MS),
      { timeZone: profile.timezone, location },
      prefs,
    );
    if (!planned.length) return 0;
    const inserted = await tx
      .insert(scheduledReminders)
      .values(
        planned.map((p) => ({
          userId,
          ruleId: p.ruleId,
          fireAt: p.fireAt,
          status: p.status,
          suppressReason: p.reason ?? null,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: scheduledReminders.id });
    return inserted.length;
  }

  /** Marks the user for re-planning, e.g. after location, time zone or week changes. Runs outside RLS (auth schema). */
  async invalidate(userId: string): Promise<void> {
    await this.handle.db.update(users).set({ planHorizon: null }).where(eq(users.id, userId));
  }

  async setHorizon(userId: string, at: Date): Promise<void> {
    await this.handle.db.update(users).set({ planHorizon: at }).where(eq(users.id, userId));
  }

  /** Cron (every 5 min): plans for users whose horizon is running out or who changed settings. */
  async planDue(now = new Date(), batch = 200): Promise<{ users: number; inserted: number }> {
    const due = await this.handle.db
      .select({ id: users.id, horizon: users.planHorizon })
      .from(users)
      .where(
        and(
          eq(users.status, 'active'),
          sql`(${users.planHorizon} is null or ${users.planHorizon} < ${new Date(now.getTime() + REPLAN_BEFORE_MS)})`,
        ),
      )
      .limit(batch);
    let inserted = 0;
    for (const u of due) {
      try {
        inserted += await withSystem(this.handle.db, (tx) =>
          this.planUser(tx, u.id, now, u.horizon === null),
        );
        await this.setHorizon(u.id, new Date(now.getTime() + HORIZON_MS));
      } catch (err) {
        this.logger.error(`planning failed for a user: ${(err as Error).message}`);
      }
    }
    return { users: due.length, inserted };
  }
}
