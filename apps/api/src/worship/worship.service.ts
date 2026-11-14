import { Inject, Injectable } from '@nestjs/common';
import type {
  ActivityDto,
  DayFlagsDto,
  LogDto,
  LogsResponse,
  ScheduleDto,
  UpdateActivity,
  UpsertLog,
} from '@tadhkirah/contracts';
import { CreateCustomActivitySchema } from '@tadhkirah/contracts';
import { and, eq, isNull, schema, sql, withUser, type DbHandle, type Tx } from '@tadhkirah/db';
import { CATALOG, CATALOG_BY_KEY } from '@tadhkirah/domain';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { DB } from '../db/db.module.js';
import { PrayerService } from '../prayer/prayer.service.js';

const { userActivities, worshipLogs, dayFlags } = schema;
const MAX_RANGE_DAYS = 92;

type ActivityRow = typeof userActivities.$inferSelect;
type LogRow = typeof worshipLogs.$inferSelect;

function toDto(a: ActivityRow): ActivityDto {
  const catalog = a.catalogKey ? CATALOG_BY_KEY.get(a.catalogKey) : undefined;
  return {
    id: a.id,
    catalogKey: a.catalogKey,
    name: a.name,
    category: a.category as ActivityDto['category'],
    obligation: a.obligation,
    measure: a.measure,
    unit: (a.unit as ActivityDto['unit']) ?? null,
    max: catalog?.max ?? null,
    schedule: a.schedule as ScheduleDto,
    dailyTarget: a.dailyTarget,
    enabled: a.enabled,
    sort: a.sort,
  };
}

function logDto(l: LogRow): LogDto {
  return {
    id: l.id,
    activityId: l.activityId,
    localDate: l.localDate,
    prayerStatus: l.prayerStatus,
    done: l.done,
    amount: l.amount,
    clientUpdatedAt: l.clientUpdatedAt.toISOString(),
  };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Worship tracker (M3). Every query runs inside withUser(), so RLS applies. */
@Injectable()
export class WorshipService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly prayer: PrayerService,
  ) {}

  // ---------- activities ----------

  /** Adds any catalog activities the user doesn't have yet (first use, or new ones in a later release). */
  private async provision(tx: Tx, userId: string): Promise<void> {
    const existing = await tx
      .select({ key: userActivities.catalogKey })
      .from(userActivities)
      .where(eq(userActivities.userId, userId));
    const have = new Set(existing.map((r) => r.key));
    const missing = CATALOG.map((c, i) => ({ c, i })).filter(({ c }) => !have.has(c.key));
    if (!missing.length) return;
    await tx.insert(userActivities).values(
      missing.map(({ c, i }) => ({
        userId,
        catalogKey: c.key,
        category: c.category,
        obligation: c.obligation,
        measure: c.measure,
        unit: c.unit ?? null,
        schedule: c.schedule,
        enabled: c.defaultEnabled,
        sort: i * 10,
      })),
    );
  }

  async listActivities(userId: string): Promise<ActivityDto[]> {
    return withUser(this.handle.db, userId, async (tx) => {
      await this.provision(tx, userId);
      const rows = await tx
        .select()
        .from(userActivities)
        .where(and(eq(userActivities.userId, userId), isNull(userActivities.archivedAt)))
        .orderBy(userActivities.sort, userActivities.createdAt);
      return rows.map(toDto);
    });
  }

  async createCustom(
    userId: string,
    body: z.output<typeof CreateCustomActivitySchema>,
  ): Promise<ActivityDto> {
    if (body.measure === 'count' && !body.unit) body.unit = 'times';
    return withUser(this.handle.db, userId, async (tx) => {
      await this.provision(tx, userId);
      const [{ maxSort } = { maxSort: 0 }] = await tx
        .select({ maxSort: sql<number>`coalesce(max(${userActivities.sort}), 0)::int` })
        .from(userActivities)
        .where(eq(userActivities.userId, userId));
      const [row] = await tx
        .insert(userActivities)
        .values({
          userId,
          catalogKey: null,
          name: body.name,
          category: 'custom',
          obligation: 'voluntary', // custom activities are never obligatory
          measure: body.measure,
          unit: body.measure === 'count' ? body.unit : null,
          schedule: body.schedule,
          dailyTarget: body.measure === 'count' ? body.dailyTarget : null,
          sort: maxSort + 10,
        })
        .returning();
      return toDto(row!);
    });
  }

  private async getActivity(tx: Tx, userId: string, id: string): Promise<ActivityRow> {
    const [row] = await tx
      .select()
      .from(userActivities)
      .where(
        and(
          eq(userActivities.id, id),
          eq(userActivities.userId, userId),
          isNull(userActivities.archivedAt),
        ),
      );
    if (!row) throw new AppError(404, 'not_found');
    return row;
  }

  async updateActivity(userId: string, id: string, patch: UpdateActivity): Promise<ActivityDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const a = await this.getActivity(tx, userId, id);
      if (a.obligation === 'obligatory') {
        if (patch.dailyTarget != null) {
          throw new AppError(
            422,
            'worship.target_on_obligatory',
            'Obligatory acts are tracked, not given goals.',
          );
        }
        if (patch.schedule && patch.schedule.type !== 'daily') {
          throw new AppError(422, 'worship.obligatory_schedule', 'Obligatory prayers are daily.');
        }
      }
      if (patch.name !== undefined && a.catalogKey) {
        throw new AppError(422, 'worship.not_custom', 'Only your own activities can be renamed.');
      }
      if (patch.dailyTarget != null && a.measure !== 'count') {
        throw new AppError(422, 'worship.target_needs_count', 'Goals apply to counted activities.');
      }
      const [row] = await tx
        .update(userActivities)
        .set(patch)
        .where(and(eq(userActivities.id, id), eq(userActivities.userId, userId)))
        .returning();
      return toDto(row!);
    });
  }

  /** Custom activities are archived (their history is kept); built-in ones can only be disabled. */
  async removeActivity(userId: string, id: string): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      const a = await this.getActivity(tx, userId, id);
      if (a.catalogKey) {
        throw new AppError(
          422,
          'worship.not_custom',
          'Built-in activities can be disabled, not removed.',
        );
      }
      await tx
        .update(userActivities)
        .set({ archivedAt: new Date(), enabled: false })
        .where(eq(userActivities.id, id));
    });
  }

  async reorder(userId: string, ids: string[]): Promise<ActivityDto[]> {
    await withUser(this.handle.db, userId, async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx
          .update(userActivities)
          .set({ sort: (i + 1) * 10 })
          .where(and(eq(userActivities.id, id), eq(userActivities.userId, userId)));
      }
    });
    return this.listActivities(userId);
  }

  // ---------- logs and day flags ----------

  private assertWritable(tx: Tx, userId: string, date: string) {
    return this.prayer.assertWritableDay(tx, userId, date);
  }

  async logs(userId: string, from: string, to: string): Promise<LogsResponse> {
    const span = daysBetween(from, to);
    if (span < 0 || span >= MAX_RANGE_DAYS) {
      throw new AppError(400, 'validation.failed', `Range must be 1–${MAX_RANGE_DAYS} days.`);
    }
    return withUser(this.handle.db, userId, async (tx) => {
      const range = (col: typeof worshipLogs.localDate | typeof dayFlags.localDate) =>
        sql`${col} between ${from} and ${to}`;
      const logs = await tx
        .select()
        .from(worshipLogs)
        .where(and(eq(worshipLogs.userId, userId), range(worshipLogs.localDate)));
      const flags = await tx
        .select()
        .from(dayFlags)
        .where(and(eq(dayFlags.userId, userId), range(dayFlags.localDate)));
      return {
        today: await this.prayer.trackingToday(tx, userId),
        backfillDays: await this.prayer.backfillDays(tx, userId),
        logs: logs.map(logDto),
        flags: flags.map((f) => ({
          localDate: f.localDate,
          excused: f.excused,
          travelling: f.travelling,
        })),
      };
    });
  }

  /**
   * Idempotent upsert keyed by (user, activity, day): retries and offline replays
   * are safe. Across devices the newer `clientUpdatedAt` wins.
   */
  async upsertLog(
    userId: string,
    date: string,
    activityId: string,
    body: UpsertLog,
  ): Promise<LogDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const a = await this.getActivity(tx, userId, activityId);
      const expected = { prayer_status: 'prayerStatus', boolean: 'done', count: 'amount' }[
        a.measure
      ];
      if (body[expected as keyof UpsertLog] === undefined) {
        throw new AppError(
          422,
          'worship.measure_mismatch',
          `This activity is logged with "${expected}".`,
        );
      }
      const max = a.catalogKey ? CATALOG_BY_KEY.get(a.catalogKey)?.max : undefined;
      if (body.amount !== undefined && max !== undefined && body.amount > max) {
        throw new AppError(422, 'validation.failed', `At most ${max}.`);
      }
      await this.assertWritable(tx, userId, date);

      const values = {
        prayerStatus: body.prayerStatus ?? null,
        done: body.done ?? null,
        amount: body.amount ?? null,
        clientUpdatedAt: new Date(body.clientUpdatedAt),
      };
      await tx
        .insert(worshipLogs)
        .values({ id: body.id, userId, activityId, localDate: date, ...values })
        .onConflictDoUpdate({
          target: [worshipLogs.userId, worshipLogs.activityId, worshipLogs.localDate],
          set: values,
          setWhere: sql`${worshipLogs.clientUpdatedAt} <= excluded.client_updated_at`,
        });
      const [row] = await tx
        .select()
        .from(worshipLogs)
        .where(
          and(
            eq(worshipLogs.userId, userId),
            eq(worshipLogs.activityId, activityId),
            eq(worshipLogs.localDate, date),
          ),
        );
      return logDto(row!);
    });
  }

  async deleteLog(userId: string, date: string, activityId: string): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      await this.assertWritable(tx, userId, date);
      await tx
        .delete(worshipLogs)
        .where(
          and(
            eq(worshipLogs.userId, userId),
            eq(worshipLogs.activityId, activityId),
            eq(worshipLogs.localDate, date),
          ),
        );
    });
  }

  async setFlags(userId: string, date: string, flags: DayFlagsDto): Promise<DayFlagsDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      await this.assertWritable(tx, userId, date);
      await tx
        .insert(dayFlags)
        .values({ userId, localDate: date, ...flags })
        .onConflictDoUpdate({ target: [dayFlags.userId, dayFlags.localDate], set: flags });
      return flags;
    });
  }
}
