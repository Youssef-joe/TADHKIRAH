import { Inject, Injectable } from '@nestjs/common';
import type {
  InboxItem,
  NotificationPrefsDto,
  ReminderRuleDto,
  UpcomingReminder,
  UpdateReminderRule,
} from '@tadhkirah/contracts';
import { CreateCustomReminderSchema, PushSubscriptionSchema } from '@tadhkirah/contracts';
import {
  and,
  desc,
  eq,
  inArray,
  schema,
  sql,
  withUser,
  type DbHandle,
  type Tx,
} from '@tadhkirah/db';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { DB } from '../db/db.module.js';
import { HORIZON_MS, PlannerService } from './planner.service.js';

const { reminderRules, scheduledReminders, notificationPreferences, pushDevices, notificationLog } =
  schema;
type RuleRow = typeof reminderRules.$inferSelect;

/** Reminder settings, devices, inbox and snooze (Module E). User-scoped: every query runs in withUser(). */
@Injectable()
export class RemindersService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(ENV) private readonly env: Env,
    private readonly planner: PlannerService,
    private readonly crypto: CryptoService,
  ) {}

  vapidPublicKey(): { key: string | null } {
    return { key: this.env.VAPID_PUBLIC_KEY ?? null };
  }

  private async ruleDto(tx: Tx, userId: string, r: RuleRow): Promise<ReminderRuleDto> {
    return {
      id: r.id,
      category: r.category,
      timing: r.timing as ReminderRuleDto['timing'],
      days: r.days,
      enabled: r.enabled,
      allowInQuietHours: r.allowInQuietHours,
      customTitle: r.customTitleCt
        ? await this.crypto.decrypt(tx, userId, `reminder|${r.id}`, r.customTitleCt)
        : null,
    };
  }

  /** Runs `fn` for the user, then re-plans their reminders right away. */
  private async changeAndReplan<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const now = new Date();
    const result = await withUser(this.handle.db, userId, async (tx) => {
      const out = await fn(tx);
      await this.planner.planUser(tx, userId, now, true);
      return out;
    });
    await this.planner.setHorizon(userId, new Date(now.getTime() + HORIZON_MS));
    return result;
  }

  async listRules(userId: string): Promise<ReminderRuleDto[]> {
    return withUser(this.handle.db, userId, async (tx) => {
      await this.planner.provision(tx, userId);
      const rows = await tx
        .select()
        .from(reminderRules)
        .where(eq(reminderRules.userId, userId))
        .orderBy(reminderRules.createdAt);
      return Promise.all(rows.map((r) => this.ruleDto(tx, userId, r)));
    });
  }

  async updateRule(
    userId: string,
    id: string,
    patch: UpdateReminderRule,
  ): Promise<ReminderRuleDto> {
    return this.changeAndReplan(userId, async (tx) => {
      const [r] = await tx
        .select()
        .from(reminderRules)
        .where(and(eq(reminderRules.id, id), eq(reminderRules.userId, userId)));
      if (!r) throw new AppError(404, 'not_found');
      if (patch.customTitle !== undefined && r.category !== 'custom') {
        throw new AppError(422, 'reminders.not_custom', 'Only your own reminders have a title.');
      }
      const [row] = await tx
        .update(reminderRules)
        .set({
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.timing ? { timing: patch.timing as unknown as Record<string, unknown> } : {}),
          ...(patch.days !== undefined ? { days: patch.days } : {}),
          ...(patch.allowInQuietHours !== undefined
            ? { allowInQuietHours: patch.allowInQuietHours }
            : {}),
          ...(patch.customTitle
            ? {
                customTitleCt: await this.crypto.encrypt(
                  tx,
                  userId,
                  `reminder|${id}`,
                  patch.customTitle,
                ),
              }
            : {}),
        })
        .where(eq(reminderRules.id, id))
        .returning();
      return this.ruleDto(tx, userId, row!);
    });
  }

  async createCustom(
    userId: string,
    body: z.output<typeof CreateCustomReminderSchema>,
  ): Promise<ReminderRuleDto> {
    return this.changeAndReplan(userId, async (tx) => {
      const id = crypto.randomUUID();
      const [row] = await tx
        .insert(reminderRules)
        .values({
          id,
          userId,
          category: 'custom',
          timing: body.timing as unknown as Record<string, unknown>,
          days: body.days,
          enabled: true,
          customTitleCt: await this.crypto.encrypt(tx, userId, `reminder|${id}`, body.customTitle),
        })
        .returning();
      return this.ruleDto(tx, userId, row!);
    });
  }

  async removeCustom(userId: string, id: string): Promise<void> {
    await this.changeAndReplan(userId, async (tx) => {
      const [r] = await tx
        .select({ category: reminderRules.category })
        .from(reminderRules)
        .where(and(eq(reminderRules.id, id), eq(reminderRules.userId, userId)));
      if (!r) throw new AppError(404, 'not_found');
      if (r.category !== 'custom')
        throw new AppError(
          422,
          'reminders.not_custom',
          'Built-in reminders can be turned off, not removed.',
        );
      await tx.delete(reminderRules).where(eq(reminderRules.id, id));
    });
  }

  async getPrefs(userId: string): Promise<NotificationPrefsDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const [p] = await tx
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      return {
        enabled: p?.enabled ?? true,
        quietStart: p?.quietStart?.slice(0, 5) ?? null,
        quietEnd: p?.quietEnd?.slice(0, 5) ?? null,
        dailyCap: p?.dailyCap ?? 6,
      };
    });
  }

  async setPrefs(userId: string, body: NotificationPrefsDto): Promise<NotificationPrefsDto> {
    await this.changeAndReplan(userId, (tx) =>
      tx
        .insert(notificationPreferences)
        .values({ userId, ...body })
        .onConflictDoUpdate({ target: notificationPreferences.userId, set: body }),
    );
    return this.getPrefs(userId);
  }

  async registerDevice(
    userId: string,
    body: z.output<typeof PushSubscriptionSchema>,
  ): Promise<{ id: string }> {
    try {
      return await withUser(this.handle.db, userId, async (tx) => {
        const [row] = await tx
          .insert(pushDevices)
          .values({
            userId,
            endpoint: body.endpoint,
            p256dh: body.keys.p256dh,
            auth: body.keys.auth,
            label: body.label ?? null,
          })
          .onConflictDoUpdate({
            target: pushDevices.endpoint,
            set: {
              p256dh: body.keys.p256dh,
              auth: body.keys.auth,
              label: body.label ?? null,
              disabledAt: null,
            },
          })
          .returning({ id: pushDevices.id });
        return row!;
      });
    } catch (err) {
      // The endpoint belongs to another account on this browser: RLS refuses the update.
      const code = (err as { cause?: { code?: string } }).cause?.code;
      if (code === '42501')
        throw new AppError(
          409,
          'reminders.device_taken',
          'This browser is linked to another account.',
        );
      throw err;
    }
  }

  async removeDevice(userId: string, endpoint: string): Promise<void> {
    await withUser(this.handle.db, userId, (tx) =>
      tx
        .delete(pushDevices)
        .where(and(eq(pushDevices.userId, userId), eq(pushDevices.endpoint, endpoint))),
    );
  }

  async devices(userId: string) {
    return withUser(this.handle.db, userId, async (tx) =>
      (
        await tx
          .select({
            id: pushDevices.id,
            label: pushDevices.label,
            endpoint: pushDevices.endpoint,
            disabledAt: pushDevices.disabledAt,
          })
          .from(pushDevices)
          .where(eq(pushDevices.userId, userId))
      ).map((d) => ({ id: d.id, label: d.label, endpoint: d.endpoint, active: !d.disabledAt })),
    );
  }

  async upcoming(userId: string, hours = 24): Promise<UpcomingReminder[]> {
    return withUser(this.handle.db, userId, async (tx) => {
      const rows = await tx
        .select({
          id: scheduledReminders.id,
          ruleId: scheduledReminders.ruleId,
          category: reminderRules.category,
          fireAt: scheduledReminders.fireAt,
          status: scheduledReminders.status,
          suppressReason: scheduledReminders.suppressReason,
        })
        .from(scheduledReminders)
        .innerJoin(reminderRules, eq(reminderRules.id, scheduledReminders.ruleId))
        .where(
          and(
            eq(scheduledReminders.userId, userId),
            inArray(scheduledReminders.status, ['pending', 'suppressed']),
            sql`${scheduledReminders.fireAt} between now() and now() + make_interval(hours => ${hours})`,
          ),
        )
        .orderBy(scheduledReminders.fireAt);
      return rows.map((r) => ({
        ...r,
        fireAt: r.fireAt.toISOString(),
        status: r.status as 'pending' | 'suppressed',
      }));
    });
  }

  async inbox(userId: string): Promise<InboxItem[]> {
    return withUser(this.handle.db, userId, async (tx) => {
      const rows = await tx
        .select()
        .from(notificationLog)
        .where(
          and(
            eq(notificationLog.userId, userId),
            sql`${notificationLog.sentAt} > now() - interval '30 days'`,
          ),
        )
        .orderBy(desc(notificationLog.sentAt))
        .limit(100);
      const ruleIds = [
        ...new Set(rows.filter((r) => r.category === 'custom' && r.ruleId).map((r) => r.ruleId!)),
      ];
      const titles = new Map<string, string | null>();
      if (ruleIds.length) {
        for (const r of await tx
          .select()
          .from(reminderRules)
          .where(inArray(reminderRules.id, ruleIds))) {
          titles.set(
            r.id,
            r.customTitleCt
              ? await this.crypto.decrypt(tx, userId, `reminder|${r.id}`, r.customTitleCt)
              : null,
          );
        }
      }
      return rows.map((r) => ({
        id: r.id,
        scheduledId: r.scheduledId,
        category: r.category,
        params: r.params,
        customTitle: r.ruleId ? (titles.get(r.ruleId) ?? null) : null,
        sentAt: r.sentAt.toISOString(),
        openedAt: r.openedAt?.toISOString() ?? null,
      }));
    });
  }

  async markOpened(userId: string, idOrScheduled: string): Promise<void> {
    await withUser(this.handle.db, userId, (tx) =>
      tx
        .update(notificationLog)
        .set({ openedAt: sql`coalesce(${notificationLog.openedAt}, now())` })
        .where(
          and(
            eq(notificationLog.userId, userId),
            sql`(${notificationLog.id} = ${idOrScheduled} or ${notificationLog.scheduledId} = ${idOrScheduled})`,
          ),
        ),
    );
  }

  /** Snooze (NOT-4): a one-off reminder N minutes from now for the same rule. Repeat-safe per minute. */
  async snooze(userId: string, scheduledId: string, minutes: number): Promise<{ fireAt: string }> {
    return withUser(this.handle.db, userId, async (tx) => {
      const [s] = await tx
        .select({ ruleId: scheduledReminders.ruleId })
        .from(scheduledReminders)
        .where(and(eq(scheduledReminders.id, scheduledId), eq(scheduledReminders.userId, userId)));
      if (!s) throw new AppError(404, 'not_found');
      const fireAt = new Date(Math.ceil((Date.now() + minutes * 60_000) / 60_000) * 60_000);
      await tx
        .insert(scheduledReminders)
        .values({ userId, ruleId: s.ruleId, fireAt, source: 'snooze' })
        .onConflictDoNothing();
      await tx
        .update(notificationLog)
        .set({ openedAt: sql`coalesce(${notificationLog.openedAt}, now())` })
        .where(
          and(eq(notificationLog.userId, userId), eq(notificationLog.scheduledId, scheduledId)),
        );
      return { fireAt: fireAt.toISOString() };
    });
  }
}
