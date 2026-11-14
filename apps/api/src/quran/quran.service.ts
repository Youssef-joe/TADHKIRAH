import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  MemorizationDto,
  QuranSummary,
  RecitationDto,
  RevisionDto,
} from '@tadhkirah/contracts';
import {
  CreateRecitationSchema,
  CreateRevisionSchema,
  UpdateMemorizationSchema,
} from '@tadhkirah/contracts';
import { and, desc, eq, schema, sql, withUser, type DbHandle, type Tx } from '@tadhkirah/db';
import {
  addDays,
  isOrdered,
  isValidRef,
  normalizeMemorization,
  revisionDue,
  surah,
  TOTAL_AYAHS,
  countAyahs,
  type LocalDate,
} from '@tadhkirah/domain';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { DB } from '../db/db.module.js';
import { PrayerService } from '../prayer/prayer.service.js';

const { quranRecitations, quranMemorization, quranRevisions, userActivities, worshipLogs } = schema;

type RecitationRow = typeof quranRecitations.$inferSelect;
type RevisionRow = typeof quranRevisions.$inferSelect;
type MemoRow = typeof quranMemorization.$inferSelect;

const recitationDto = (r: RecitationRow): RecitationDto => ({
  id: r.id,
  localDate: r.localDate,
  pages: r.pages,
  from: r.fromSurah ? { surah: r.fromSurah, ayah: r.fromAyah! } : null,
  to: r.toSurah ? { surah: r.toSurah, ayah: r.toAyah! } : null,
});
const revisionDto = (r: RevisionRow): RevisionDto => ({
  id: r.id,
  localDate: r.localDate,
  surah: r.surah,
  fromAyah: r.fromAyah,
  toAyah: r.toAyah,
  quality: r.quality,
});
const memoDto = (m: MemoRow): MemorizationDto => ({
  surah: m.surah,
  status: m.status,
  ranges: m.ranges,
  lastRevisedOn: m.lastRevisedOn,
});

/** Quran progress (M4): recitation, memorization and revision. Every query runs inside withUser(). */
@Injectable()
export class QuranService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly prayer: PrayerService,
  ) {}

  async summary(userId: string): Promise<QuranSummary> {
    return withUser(this.handle.db, userId, async (tx) => {
      const today = await this.prayer.trackingToday(tx, userId);
      const backfillDays = await this.prayer.backfillDays(tx, userId);
      const memo = await tx
        .select()
        .from(quranMemorization)
        .where(eq(quranMemorization.userId, userId));
      const since = addDays(today, -6);
      const recitations = await tx
        .select()
        .from(quranRecitations)
        .where(
          and(eq(quranRecitations.userId, userId), sql`${quranRecitations.localDate} >= ${since}`),
        )
        .orderBy(desc(quranRecitations.localDate), desc(quranRecitations.createdAt));
      const revisions = await tx
        .select()
        .from(quranRevisions)
        .where(and(eq(quranRevisions.userId, userId), sql`${quranRevisions.localDate} >= ${since}`))
        .orderBy(desc(quranRevisions.localDate), desc(quranRevisions.createdAt));

      const memorized = memo.filter((m) => m.status === 'memorized');
      return {
        today,
        backfillDays,
        totalAyahs: TOTAL_AYAHS,
        memorizedAyahs: memo.reduce((n, m) => n + countAyahs(m.ranges), 0),
        memorizedSurahs: memorized.length,
        inProgressSurahs: memo.filter((m) => m.status === 'in_progress').length,
        memorization: memo.map(memoDto),
        revisionDue: revisionDue(
          memorized.map((m) => ({
            surah: m.surah,
            lastRevisedOn: m.lastRevisedOn as LocalDate | null,
          })),
          today,
        ),
        recentRecitations: recitations.map(recitationDto),
        recentRevisions: revisions.map(revisionDto),
      };
    });
  }

  // ---------- recitation ----------

  async addRecitation(
    userId: string,
    body: z.output<typeof CreateRecitationSchema>,
  ): Promise<RecitationDto> {
    if (body.from && body.to) {
      if (!isValidRef(body.from) || !isValidRef(body.to)) {
        throw new AppError(
          422,
          'quran.invalid_reference',
          'That ayah does not exist in this surah.',
        );
      }
      if (!isOrdered(body.from, body.to)) {
        throw new AppError(422, 'quran.invalid_range', 'The start must come before the end.');
      }
    }
    return withUser(this.handle.db, userId, async (tx) => {
      await this.prayer.assertWritableDay(tx, userId, body.localDate);
      await tx
        .insert(quranRecitations)
        .values({
          id: body.id,
          userId,
          localDate: body.localDate,
          pages: body.pages,
          fromSurah: body.from?.surah ?? null,
          fromAyah: body.from?.ayah ?? null,
          toSurah: body.to?.surah ?? null,
          toAyah: body.to?.ayah ?? null,
        })
        .onConflictDoNothing(); // same id again = retry, nothing to do
      await this.syncPages(tx, userId, body.localDate);
      const [row] = await tx
        .select()
        .from(quranRecitations)
        .where(eq(quranRecitations.id, body.id));
      if (!row || row.userId !== userId) throw new AppError(409, 'conflict');
      return recitationDto(row);
    });
  }

  async deleteRecitation(userId: string, id: string): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(quranRecitations)
        .where(and(eq(quranRecitations.id, id), eq(quranRecitations.userId, userId)));
      if (!row) throw new AppError(404, 'not_found');
      await this.prayer.assertWritableDay(tx, userId, row.localDate);
      await tx.delete(quranRecitations).where(eq(quranRecitations.id, id));
      await this.syncPages(tx, userId, row.localDate);
    });
  }

  /**
   * Keeps the Today page's "Quran portion" (the quran_pages worship activity) in
   * line with the day's logged pages. If there are no pages, a value entered by
   * hand is left alone.
   */
  private async syncPages(tx: Tx, userId: string, date: string): Promise<void> {
    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`coalesce(sum(${quranRecitations.pages}), 0)::float` })
      .from(quranRecitations)
      .where(and(eq(quranRecitations.userId, userId), eq(quranRecitations.localDate, date)));
    if (!total) return;
    const [activity] = await tx
      .select({ id: userActivities.id })
      .from(userActivities)
      .where(and(eq(userActivities.userId, userId), eq(userActivities.catalogKey, 'quran_pages')));
    if (!activity) return;
    const now = new Date();
    await tx
      .insert(worshipLogs)
      .values({
        id: randomUUID(),
        userId,
        activityId: activity.id,
        localDate: date,
        amount: total,
        clientUpdatedAt: now,
      })
      .onConflictDoUpdate({
        target: [worshipLogs.userId, worshipLogs.activityId, worshipLogs.localDate],
        set: { amount: total, prayerStatus: null, done: null, clientUpdatedAt: now },
      });
  }

  // ---------- memorization ----------

  async listMemorization(userId: string): Promise<MemorizationDto[]> {
    return withUser(this.handle.db, userId, async (tx) =>
      (await tx.select().from(quranMemorization).where(eq(quranMemorization.userId, userId))).map(
        memoDto,
      ),
    );
  }

  async setMemorization(
    userId: string,
    surahN: number,
    body: z.output<typeof UpdateMemorizationSchema>,
  ): Promise<MemorizationDto> {
    const total = surah(surahN).ayahs;
    if (body.ranges.some(([a, b]) => a > total || b > total)) {
      throw new AppError(422, 'quran.invalid_reference', `This surah has ${total} ayahs.`);
    }
    const { status, ranges } = normalizeMemorization(surahN, body.status, body.ranges);
    return withUser(this.handle.db, userId, async (tx) => {
      const [row] = await tx
        .insert(quranMemorization)
        .values({ userId, surah: surahN, status, ranges })
        .onConflictDoUpdate({
          target: [quranMemorization.userId, quranMemorization.surah],
          set: { status, ranges },
        })
        .returning();
      return memoDto(row!);
    });
  }

  // ---------- revision ----------

  async addRevision(
    userId: string,
    body: z.output<typeof CreateRevisionSchema>,
  ): Promise<RevisionDto> {
    const total = surah(body.surah).ayahs;
    if (body.toAyah > total || body.fromAyah > body.toAyah) {
      throw new AppError(422, 'quran.invalid_range', `Choose ayahs between 1 and ${total}.`);
    }
    return withUser(this.handle.db, userId, async (tx) => {
      await this.prayer.assertWritableDay(tx, userId, body.localDate);
      await tx
        .insert(quranRevisions)
        .values({ ...body, userId })
        .onConflictDoNothing();
      // Track the latest revision date for this surah (creating the row if needed).
      await tx
        .insert(quranMemorization)
        .values({
          userId,
          surah: body.surah,
          status: 'not_started',
          ranges: [],
          lastRevisedOn: body.localDate,
        })
        .onConflictDoUpdate({
          target: [quranMemorization.userId, quranMemorization.surah],
          set: {
            lastRevisedOn: sql`greatest(coalesce(${quranMemorization.lastRevisedOn}, ${body.localDate}::date), ${body.localDate}::date)`,
          },
        });
      const [row] = await tx.select().from(quranRevisions).where(eq(quranRevisions.id, body.id));
      if (!row || row.userId !== userId) throw new AppError(409, 'conflict');
      return revisionDto(row);
    });
  }

  async deleteRevision(userId: string, id: string): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(quranRevisions)
        .where(and(eq(quranRevisions.id, id), eq(quranRevisions.userId, userId)));
      if (!row) throw new AppError(404, 'not_found');
      await this.prayer.assertWritableDay(tx, userId, row.localDate);
      await tx.delete(quranRevisions).where(eq(quranRevisions.id, id));
      const [latest] = await tx
        .select({ d: sql<string | null>`max(${quranRevisions.localDate})::text` })
        .from(quranRevisions)
        .where(and(eq(quranRevisions.userId, userId), eq(quranRevisions.surah, row.surah)));
      await tx
        .update(quranMemorization)
        .set({ lastRevisedOn: latest?.d ?? null })
        .where(and(eq(quranMemorization.userId, userId), eq(quranMemorization.surah, row.surah)));
    });
  }
}
