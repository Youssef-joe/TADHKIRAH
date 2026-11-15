import { Inject, Injectable } from '@nestjs/common';
import type {
  GoalDto,
  MonthlyReport,
  UpdateGoal,
  WeeklyReport,
  WeeklyReviewDto,
} from '@tadhkirah/contracts';
import { CreateGoalSchema, SaveWeeklyReviewSchema } from '@tadhkirah/contracts';
import {
  and,
  desc,
  eq,
  isNull,
  schema,
  sql,
  withUser,
  type DbHandle,
  type Tx,
} from '@tadhkirah/db';
import {
  addDays,
  consistency,
  countAyahs,
  dayState,
  monthDates,
  monthOf,
  needsAttention,
  weekDates,
  weekStartFor,
  type ActivityLike,
  type DayFlagsLike,
  type LocalDate,
  type LogLike,
  type ReportCalendar,
} from '@tadhkirah/domain';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { DB } from '../db/db.module.js';
import { PrayerService } from '../prayer/prayer.service.js';

const {
  userActivities,
  worshipLogs,
  dayFlags,
  userPreferences,
  quranRecitations,
  quranRevisions,
  quranMemorization,
  dailyReflections,
  weeklyReviews,
  improvementGoals,
} = schema;

type GoalRow = typeof improvementGoals.$inferSelect;

/**
 * Weekly reports (M7): behavioural counts only. There's no score, no
 * percentage of faith, no ranking (PRD REP-8). Excused days leave the
 * denominators of prayer and fasting.
 */
@Injectable()
export class ReportsService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly prayer: PrayerService,
    private readonly crypto: CryptoService,
  ) {}

  private async weekBounds(tx: Tx, userId: string, requested?: string) {
    const today = await this.prayer.trackingToday(tx, userId);
    const [prefs] = await tx
      .select({ weekStart: userPreferences.weekStart })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    const ws = weekStartFor((requested ?? today) as LocalDate, prefs?.weekStart ?? 6);
    if (ws > today)
      throw new AppError(422, 'reports.future_week', 'This week has not started yet.');
    return { today, weekStart: ws, days: weekDates(ws) };
  }

  private async goalDto(tx: Tx, userId: string, g: GoalRow): Promise<GoalDto> {
    return {
      id: g.id,
      text: (await this.crypto.decrypt(tx, userId, `goal|${g.id}`, g.textCt)) ?? '',
      source: g.source,
      status: g.status,
      startsOn: g.startsOn,
      endsOn: g.endsOn,
    };
  }

  async weekly(userId: string, requested?: string): Promise<WeeklyReport> {
    return withUser(this.handle.db, userId, async (tx) => {
      const { today, weekStart, days } = await this.weekBounds(tx, userId, requested);
      const [review] = await tx
        .select({ id: weeklyReviews.id })
        .from(weeklyReviews)
        .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)));
      return {
        weekStart,
        weekEnd: days[6]!,
        isCurrentWeek: today <= days[6]!,
        ...(await this.period(tx, userId, days, today)),
        reviewSaved: Boolean(review),
      };
    });
  }

  /** Monthly report (REP-7): the weekly structure over a Gregorian or Hijri month. */
  async monthly(
    userId: string,
    calendar: ReportCalendar,
    requested?: string,
  ): Promise<MonthlyReport> {
    return withUser(this.handle.db, userId, async (tx) => {
      const today = await this.prayer.trackingToday(tx, userId);
      const [prefs] = await tx
        .select({ hijriOffset: userPreferences.hijriOffset })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));
      const offset = prefs?.hijriOffset ?? 0;
      const month = requested ?? monthOf(today, calendar, offset);
      const days = monthDates(month, calendar, offset);
      const start = days[0]!;
      const end = days.at(-1)!;
      if (start > today)
        throw new AppError(422, 'reports.future_month', 'This month has not started yet.');
      const [reviews] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(weeklyReviews)
        .where(
          and(
            eq(weeklyReviews.userId, userId),
            sql`${weeklyReviews.weekStart} between ${start} and ${end}`,
          ),
        );
      return {
        calendar,
        month,
        start,
        end,
        isCurrentMonth: today <= end,
        ...(await this.period(tx, userId, days, today)),
        reviewsSaved: reviews?.n ?? 0,
      };
    });
  }

  /** Counts over a run of tracking days, shared by weekly and monthly reports. */
  private async period(tx: Tx, userId: string, days: LocalDate[], today: LocalDate) {
    const from = days[0]!;
    const to = days.at(-1)!;
    const inPeriod = (col: Parameters<typeof sql>[1]) => sql`${col} between ${from} and ${to}`;

    const acts = await tx
      .select()
      .from(userActivities)
      .where(
        and(
          eq(userActivities.userId, userId),
          isNull(userActivities.archivedAt),
          eq(userActivities.enabled, true),
        ),
      )
      .orderBy(userActivities.sort, userActivities.createdAt);
    const logs = await tx
      .select()
      .from(worshipLogs)
      .where(and(eq(worshipLogs.userId, userId), inPeriod(worshipLogs.localDate)));
    const flagRows = await tx
      .select()
      .from(dayFlags)
      .where(and(eq(dayFlags.userId, userId), inPeriod(dayFlags.localDate)));
    const flags = new Map<LocalDate, DayFlagsLike>(
      flagRows.map((f) => [f.localDate as LocalDate, f]),
    );

    const activities = acts.map((a) => {
      const activity: ActivityLike = {
        category: a.category as ActivityLike['category'],
        measure: a.measure,
        schedule: a.schedule as unknown as ActivityLike['schedule'],
        dailyTarget: a.dailyTarget,
      };
      const own = logs.filter((l) => l.activityId === a.id);
      const logMap = new Map<LocalDate, LogLike>(own.map((l) => [l.localDate as LocalDate, l]));
      const c = consistency(activity, from, to, today, logMap, flags);
      const breakdown =
        a.measure === 'prayer_status'
          ? {
              on_time: own.filter((l) => l.prayerStatus === 'on_time').length,
              later: own.filter((l) => l.prayerStatus === 'later').length,
              qada: own.filter((l) => l.prayerStatus === 'qada').length,
            }
          : null;
      return {
        activityId: a.id,
        catalogKey: a.catalogKey,
        name: a.name,
        category: a.category,
        obligation: a.obligation,
        eligible: c.eligible,
        logged: c.logged,
        excused: c.excused,
        perDay: days.map((d) => dayState(activity, d, today, logMap.get(d), flags.get(d))),
        statusBreakdown: breakdown,
        needsAttention: needsAttention(c),
      };
    });

    // Quran: pages come from the Today "Quran portion" (which recitation logs feed).
    const quranPagesAct = acts.find((a) => a.catalogKey === 'quran_pages');
    const pageLogs = quranPagesAct
      ? logs.filter((l) => l.activityId === quranPagesAct.id && (l.amount ?? 0) > 0)
      : [];
    const recitations = await tx
      .select({ localDate: quranRecitations.localDate, pages: quranRecitations.pages })
      .from(quranRecitations)
      .where(and(eq(quranRecitations.userId, userId), inPeriod(quranRecitations.localDate)));
    const revisions = await tx
      .select({ fromAyah: quranRevisions.fromAyah, toAyah: quranRevisions.toAyah })
      .from(quranRevisions)
      .where(and(eq(quranRevisions.userId, userId), inPeriod(quranRevisions.localDate)));
    const memo = await tx
      .select({ ranges: quranMemorization.ranges })
      .from(quranMemorization)
      .where(eq(quranMemorization.userId, userId));
    const pages = pageLogs.length
      ? pageLogs.reduce((n, l) => n + (l.amount ?? 0), 0)
      : recitations.reduce((n, r) => n + (r.pages ?? 0), 0);
    const recitationDays = new Set([
      ...pageLogs.map((l) => l.localDate),
      ...recitations.map((r) => r.localDate),
    ]).size;

    const refl = await tx
      .select({
        localDate: dailyReflections.localDate,
        completedAt: dailyReflections.completedAt,
      })
      .from(dailyReflections)
      .where(and(eq(dailyReflections.userId, userId), inPeriod(dailyReflections.localDate)));
    const reflDates = new Set(refl.map((r) => r.localDate));

    const goals = await tx
      .select()
      .from(improvementGoals)
      .where(
        and(
          eq(improvementGoals.userId, userId),
          sql`(${improvementGoals.status} = 'active' or ${improvementGoals.startsOn} between ${from} and ${to})`,
        ),
      )
      .orderBy(desc(improvementGoals.createdAt));

    return {
      today,
      days,
      excusedDays: flagRows.filter((f) => f.excused && f.localDate <= today).length,
      activities,
      quran: {
        pages: Math.round(pages * 10) / 10,
        recitationDays,
        revisedAyahs: revisions.reduce((n, r) => n + (r.toAyah - r.fromAyah + 1), 0),
        revisions: revisions.length,
        memorizedAyahs: memo.reduce((n, m) => n + countAyahs(m.ranges), 0),
      },
      reflections: {
        written: refl.length,
        completed: refl.filter((r) => r.completedAt).length,
        perDay: days.map((d) => reflDates.has(d)),
      },
      goals: await Promise.all(goals.map((g) => this.goalDto(tx, userId, g))),
    };
  }

  // ---------- weekly review (encrypted) ----------

  async getReview(userId: string, requested: string): Promise<WeeklyReviewDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const { weekStart } = await this.weekBounds(tx, userId, requested);
      const [r] = await tx
        .select()
        .from(weeklyReviews)
        .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)));
      const d = (f: string, b: Buffer | null | undefined) =>
        this.crypto.decrypt(tx, userId, `weekly|${weekStart}|${f}`, b ?? null);
      return {
        weekStart,
        improved: await d('improved', r?.improvedCt),
        neglected: await d('neglected', r?.neglectedCt),
        madeEasier: await d('madeEasier', r?.madeEasierCt),
        changeNext: await d('changeNext', r?.changeNextCt),
      };
    });
  }

  async saveReview(
    userId: string,
    requested: string,
    body: z.output<typeof SaveWeeklyReviewSchema>,
  ): Promise<WeeklyReviewDto> {
    await withUser(this.handle.db, userId, async (tx) => {
      const { weekStart } = await this.weekBounds(tx, userId, requested);
      const e = (f: string, v: string | null) =>
        this.crypto.encrypt(tx, userId, `weekly|${weekStart}|${f}`, v);
      const values = {
        improvedCt: await e('improved', body.improved),
        neglectedCt: await e('neglected', body.neglected),
        madeEasierCt: await e('madeEasier', body.madeEasier),
        changeNextCt: await e('changeNext', body.changeNext),
      };
      await tx
        .insert(weeklyReviews)
        .values({ userId, weekStart, ...values })
        .onConflictDoUpdate({
          target: [weeklyReviews.userId, weeklyReviews.weekStart],
          set: values,
        });
      if (body.makeGoal && body.changeNext) {
        await this.insertGoal(
          tx,
          userId,
          body.changeNext,
          'weekly_review',
          addDays(weekStart, 7),
          addDays(weekStart, 13),
        );
      }
    });
    return this.getReview(userId, requested);
  }

  // ---------- goals ----------

  private async insertGoal(
    tx: Tx,
    userId: string,
    text: string,
    source: GoalRow['source'],
    startsOn: string,
    endsOn: string | null,
  ): Promise<GoalRow> {
    const id = crypto.randomUUID();
    const [row] = await tx
      .insert(improvementGoals)
      .values({
        id,
        userId,
        textCt: (await this.crypto.encrypt(tx, userId, `goal|${id}`, text))!,
        source,
        startsOn,
        endsOn,
      })
      .returning();
    return row!;
  }

  async listGoals(userId: string, status?: string): Promise<GoalDto[]> {
    return withUser(this.handle.db, userId, async (tx) => {
      const rows = await tx
        .select()
        .from(improvementGoals)
        .where(
          and(
            eq(improvementGoals.userId, userId),
            status ? eq(improvementGoals.status, status as GoalRow['status']) : undefined,
          ),
        )
        .orderBy(desc(improvementGoals.createdAt));
      return Promise.all(rows.map((g) => this.goalDto(tx, userId, g)));
    });
  }

  async createGoal(userId: string, body: z.output<typeof CreateGoalSchema>): Promise<GoalDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const today = await this.prayer.trackingToday(tx, userId);
      const row = await this.insertGoal(
        tx,
        userId,
        body.text,
        'manual',
        body.startsOn ?? today,
        body.endsOn,
      );
      return this.goalDto(tx, userId, row);
    });
  }

  async updateGoal(userId: string, id: string, patch: UpdateGoal): Promise<GoalDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const [g] = await tx
        .select()
        .from(improvementGoals)
        .where(and(eq(improvementGoals.id, id), eq(improvementGoals.userId, userId)));
      if (!g) throw new AppError(404, 'not_found');
      const [row] = await tx
        .update(improvementGoals)
        .set({
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.text
            ? { textCt: (await this.crypto.encrypt(tx, userId, `goal|${id}`, patch.text))! }
            : {}),
        })
        .where(eq(improvementGoals.id, id))
        .returning();
      return this.goalDto(tx, userId, row!);
    });
  }
}
