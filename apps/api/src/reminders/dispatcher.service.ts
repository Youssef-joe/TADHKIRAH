import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, schema, sql, withSystem, withUser, type DbHandle } from '@tadhkirah/db';
import { CryptoService } from '../crypto/crypto.service.js';
import { DB } from '../db/db.module.js';
import { PUSH_CHANNEL, type PushChannel } from './push.channel.js';
import { render } from './templates.js';

const { scheduledReminders, reminderRules, pushDevices, notificationLog, userProfiles } = schema;

/** Reminders more than 15 minutes late are dropped instead of sent late. */
export const EXPIRE_AFTER_MS = 15 * 60 * 1000;

/**
 * Sends due reminders (cron every minute). Rows are claimed with
 * FOR UPDATE SKIP LOCKED plus a status change, so concurrent runs never send
 * the same reminder twice. The push Topic header lets push services replace an
 * undelivered duplicate.
 */
@Injectable()
export class DispatcherService {
  private readonly logger = new Logger(DispatcherService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(PUSH_CHANNEL) private readonly push: PushChannel,
    private readonly crypto: CryptoService,
  ) {}

  async dispatch(
    now = new Date(),
    batch = 200,
  ): Promise<{ sent: number; expired: number; pushed: number }> {
    const db = this.handle.db;
    const expiredBefore = new Date(now.getTime() - EXPIRE_AFTER_MS);

    const { claimed, expired } = await withSystem(db, async (tx) => {
      const exp = await tx
        .update(scheduledReminders)
        .set({ status: 'expired' })
        .where(
          and(
            eq(scheduledReminders.status, 'pending'),
            sql`${scheduledReminders.fireAt} < ${expiredBefore}`,
          ),
        )
        .returning({ id: scheduledReminders.id });
      const rows = await tx.execute<{ id: string; user_id: string; rule_id: string }>(sql`
        update app.scheduled_reminders s set status = 'sending', attempts = s.attempts + 1
        where s.id in (
          select id from app.scheduled_reminders
          where status = 'pending' and fire_at <= ${now}
          order by fire_at
          for update skip locked
          limit ${batch}
        )
        returning s.id, s.user_id, s.rule_id`);
      return { claimed: rows.rows, expired: exp.length };
    });

    let pushed = 0;
    for (const item of claimed) {
      try {
        pushed += await this.deliver(item.id, item.user_id, item.rule_id);
      } catch (err) {
        this.logger.error(`delivery failed: ${(err as Error).message}`);
        await withSystem(db, (tx) =>
          tx
            .update(scheduledReminders)
            .set({ status: 'failed' })
            .where(eq(scheduledReminders.id, item.id)),
        );
      }
    }
    return { sent: claimed.length, expired, pushed };
  }

  private async deliver(scheduledId: string, userId: string, ruleId: string): Promise<number> {
    const db = this.handle.db;
    const { rule, locale, devices } = await withSystem(db, async (tx) => {
      const [r] = await tx.select().from(reminderRules).where(eq(reminderRules.id, ruleId));
      const [p] = await tx
        .select({ locale: userProfiles.locale })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      const d = await tx
        .select()
        .from(pushDevices)
        .where(and(eq(pushDevices.userId, userId), isNull(pushDevices.disabledAt)));
      return { rule: r, locale: p?.locale ?? 'ar', devices: d };
    });
    if (!rule) return 0;

    const timing = rule.timing as { type: string; prayer?: string; offsetMin?: number };
    const params: Record<string, string> =
      rule.category === 'prayer'
        ? { prayer: timing.prayer ?? '', offsetMin: String(timing.offsetMin ?? 0) }
        : {};
    // Custom titles are encrypted: decrypt them in the user's own scope, never in system mode.
    const customTitle = rule.customTitleCt
      ? await withUser(db, userId, (tx) =>
          this.crypto.decrypt(tx, userId, `reminder|${rule.id}`, rule.customTitleCt),
        )
      : null;
    const n = render(rule.category, params, locale, customTitle);

    let pushed = 0;
    if (this.push.enabled) {
      const topic = createHash('sha256').update(ruleId).digest('base64url').slice(0, 32);
      for (const dev of devices) {
        const result = await this.push.send(
          dev,
          {
            title: n.title,
            body: n.body,
            url: n.url,
            scheduledId,
            snoozeLabel: n.snoozeLabel,
            tag: rule.category,
          },
          { ttlSeconds: EXPIRE_AFTER_MS / 1000, topic },
        );
        if (result === 'ok') pushed++;
        if (result === 'ok' || result === 'gone') {
          await withSystem(db, (tx) =>
            tx
              .update(pushDevices)
              .set(result === 'ok' ? { lastSuccessAt: new Date() } : { disabledAt: new Date() })
              .where(eq(pushDevices.id, dev.id)),
          );
        }
      }
    }

    await withSystem(db, async (tx) => {
      await tx
        .insert(notificationLog)
        .values({ userId, scheduledId, ruleId, category: rule.category, params, pushed })
        .onConflictDoNothing();
      await tx
        .update(scheduledReminders)
        .set({ status: 'sent' })
        .where(eq(scheduledReminders.id, scheduledId));
    });
    return pushed;
  }
}
