import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ReflectionDayResponse,
  ReflectionDto,
  ReflectionQuestionDto,
  UpdateQuestion,
} from '@tadhkirah/contracts';
import { CreateQuestionSchema, SaveReflectionSchema } from '@tadhkirah/contracts';
import {
  and,
  eq,
  inArray,
  isNull,
  schema,
  sql,
  withUser,
  type DbHandle,
  type Tx,
} from '@tadhkirah/db';
import { QUESTION_BY_KEY, QUESTION_CATALOG, suggestChoice, type Choice } from '@tadhkirah/domain';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { DB } from '../db/db.module.js';
import { PrayerService } from '../prayer/prayer.service.js';

const { reflectionQuestions, dailyReflections, reflectionAnswers, userActivities, worshipLogs } =
  schema;
type QuestionRow = typeof reflectionQuestions.$inferSelect;

/**
 * Daily self-accountability (M5). Every piece of free text is encrypted with
 * the user's key before it reaches the database. Structured choices stay
 * plaintext so reports can count them, but never what was written.
 */
@Injectable()
export class ReflectionService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly crypto: CryptoService,
    private readonly prayer: PrayerService,
  ) {}

  // ---------- questions ----------

  private async provision(tx: Tx, userId: string): Promise<void> {
    const rows = await tx
      .select({ key: reflectionQuestions.catalogKey })
      .from(reflectionQuestions)
      .where(eq(reflectionQuestions.userId, userId));
    const have = new Set(rows.map((r) => r.key));
    const missing = QUESTION_CATALOG.map((q, i) => ({ q, i })).filter(({ q }) => !have.has(q.key));
    if (!missing.length) return;
    await tx.insert(reflectionQuestions).values(
      missing.map(({ q, i }) => ({
        userId,
        catalogKey: q.key,
        answerType: q.answerType,
        sort: i * 10,
      })),
    );
  }

  private async questionDto(
    tx: Tx,
    userId: string,
    q: QuestionRow,
  ): Promise<ReflectionQuestionDto> {
    return {
      id: q.id,
      catalogKey: q.catalogKey,
      text: q.catalogKey
        ? null
        : await this.crypto.decrypt(tx, userId, `question|${q.id}`, q.textCt),
      answerType: q.answerType,
      enabled: q.enabled,
      sort: q.sort,
    };
  }

  private async questions(tx: Tx, userId: string): Promise<QuestionRow[]> {
    await this.provision(tx, userId);
    return tx
      .select()
      .from(reflectionQuestions)
      .where(and(eq(reflectionQuestions.userId, userId), isNull(reflectionQuestions.archivedAt)))
      .orderBy(reflectionQuestions.sort, reflectionQuestions.createdAt);
  }

  async listQuestions(userId: string): Promise<ReflectionQuestionDto[]> {
    return withUser(this.handle.db, userId, async (tx) =>
      Promise.all((await this.questions(tx, userId)).map((q) => this.questionDto(tx, userId, q))),
    );
  }

  async createQuestion(
    userId: string,
    body: z.output<typeof CreateQuestionSchema>,
  ): Promise<ReflectionQuestionDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const all = await this.questions(tx, userId);
      const id = randomUUID();
      const [row] = await tx
        .insert(reflectionQuestions)
        .values({
          id,
          userId,
          catalogKey: null,
          textCt: await this.crypto.encrypt(tx, userId, `question|${id}`, body.text),
          answerType: body.answerType,
          sort: (all.at(-1)?.sort ?? 0) + 10,
        })
        .returning();
      return this.questionDto(tx, userId, row!);
    });
  }

  private async getQuestion(tx: Tx, userId: string, id: string): Promise<QuestionRow> {
    const [q] = await tx
      .select()
      .from(reflectionQuestions)
      .where(
        and(
          eq(reflectionQuestions.id, id),
          eq(reflectionQuestions.userId, userId),
          isNull(reflectionQuestions.archivedAt),
        ),
      );
    if (!q) throw new AppError(404, 'not_found');
    return q;
  }

  async updateQuestion(
    userId: string,
    id: string,
    patch: UpdateQuestion,
  ): Promise<ReflectionQuestionDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      const q = await this.getQuestion(tx, userId, id);
      if (q.catalogKey && (patch.text !== undefined || patch.answerType !== undefined)) {
        throw new AppError(
          422,
          'reflection.not_custom',
          'Built-in questions can be hidden, not edited.',
        );
      }
      const [row] = await tx
        .update(reflectionQuestions)
        .set({
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.answerType ? { answerType: patch.answerType } : {}),
          ...(patch.text
            ? { textCt: await this.crypto.encrypt(tx, userId, `question|${id}`, patch.text) }
            : {}),
        })
        .where(eq(reflectionQuestions.id, id))
        .returning();
      return this.questionDto(tx, userId, row!);
    });
  }

  async removeQuestion(userId: string, id: string): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      const q = await this.getQuestion(tx, userId, id);
      if (q.catalogKey)
        throw new AppError(
          422,
          'reflection.not_custom',
          'Built-in questions can be hidden, not removed.',
        );
      await tx
        .update(reflectionQuestions)
        .set({ archivedAt: new Date(), enabled: false })
        .where(eq(reflectionQuestions.id, id));
    });
  }

  async reorderQuestions(userId: string, ids: string[]): Promise<ReflectionQuestionDto[]> {
    await withUser(this.handle.db, userId, async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx
          .update(reflectionQuestions)
          .set({ sort: (i + 1) * 10 })
          .where(and(eq(reflectionQuestions.id, id), eq(reflectionQuestions.userId, userId)));
      }
    });
    return this.listQuestions(userId);
  }

  // ---------- reflections ----------

  private async load(tx: Tx, userId: string, date: string): Promise<ReflectionDto | null> {
    const [r] = await tx
      .select()
      .from(dailyReflections)
      .where(and(eq(dailyReflections.userId, userId), eq(dailyReflections.localDate, date)));
    if (!r) return null;
    const ctx = (field: string) => `reflection|${date}|${field}`;
    const answers = await tx
      .select()
      .from(reflectionAnswers)
      .where(eq(reflectionAnswers.reflectionId, r.id));
    const gratitude = await this.crypto.decrypt(tx, userId, ctx('gratitude'), r.gratitudeCt);
    return {
      localDate: r.localDate,
      version: r.version,
      answers: await Promise.all(
        answers.map(async (a) => ({
          questionId: a.questionId,
          choice: a.choice,
          text: await this.crypto.decrypt(tx, userId, `answer|${date}|${a.questionId}`, a.textCt),
        })),
      ),
      gratitude: gratitude ? (JSON.parse(gratitude) as string[]) : [],
      shortcoming: await this.crypto.decrypt(tx, userId, ctx('shortcoming'), r.shortcomingCt),
      repentanceNoted: r.repentanceNoted,
      intention: await this.crypto.decrypt(tx, userId, ctx('intention'), r.intentionCt),
      freeText: await this.crypto.decrypt(tx, userId, ctx('freeText'), r.freeTextCt),
      completedAt: r.completedAt?.toISOString() ?? null,
    };
  }

  /** Answers suggested by the day's worship log (REF-9); the user always confirms. */
  private async suggestions(
    tx: Tx,
    userId: string,
    date: string,
    questions: QuestionRow[],
  ): Promise<Record<string, Choice>> {
    const withPrefill = questions.filter(
      (q) => q.catalogKey && QUESTION_BY_KEY.get(q.catalogKey)?.prefill,
    );
    if (!withPrefill.length) return {};
    const acts = await tx
      .select()
      .from(userActivities)
      .where(and(eq(userActivities.userId, userId), isNull(userActivities.archivedAt)));
    const logs = await tx
      .select()
      .from(worshipLogs)
      .where(and(eq(worshipLogs.userId, userId), eq(worshipLogs.localDate, date)));
    const logOf = (activityId?: string) => logs.find((l) => l.activityId === activityId);
    const byKey = (k: string) => acts.find((a) => a.catalogKey === k);
    const prayers = acts
      .filter((a) => a.obligation === 'obligatory' && a.enabled)
      .map((a) => logOf(a.id)?.prayerStatus ?? null);
    const quran = byKey('quran_pages');
    const input = {
      prayers,
      quran: quran
        ? { amount: logOf(quran.id)?.amount ?? 0, target: quran.dailyTarget }
        : undefined,
      adhkar: {
        morning: logOf(byKey('morning_adhkar')?.id)?.done === true,
        evening: logOf(byKey('evening_adhkar')?.id)?.done === true,
      },
    };
    const out: Record<string, Choice> = {};
    for (const q of withPrefill) {
      const choice = suggestChoice(QUESTION_BY_KEY.get(q.catalogKey!)!.prefill, input);
      if (choice) out[q.id] = choice;
    }
    return out;
  }

  async day(userId: string, date: string): Promise<ReflectionDayResponse> {
    return withUser(this.handle.db, userId, async (tx) => {
      const today = await this.prayer.trackingToday(tx, userId);
      if (date > today)
        throw new AppError(422, 'worship.outside_backfill_window', 'This day has not come yet.');
      const questions = await this.questions(tx, userId);
      return {
        today,
        backfillDays: await this.prayer.backfillDays(tx, userId),
        questions: await Promise.all(questions.map((q) => this.questionDto(tx, userId, q))),
        reflection: await this.load(tx, userId, date),
        suggestions: await this.suggestions(
          tx,
          userId,
          date,
          questions.filter((q) => q.enabled),
        ),
      };
    });
  }

  async save(
    userId: string,
    date: string,
    body: z.output<typeof SaveReflectionSchema>,
  ): Promise<ReflectionDto> {
    return withUser(this.handle.db, userId, async (tx) => {
      await this.prayer.assertWritableDay(tx, userId, date);
      const [existing] = await tx
        .select()
        .from(dailyReflections)
        .where(and(eq(dailyReflections.userId, userId), eq(dailyReflections.localDate, date)))
        .for('update');
      if (existing && body.version !== undefined && body.version !== existing.version) {
        throw new AppError(
          409,
          'reflection.version_conflict',
          'This reflection was changed on another device.',
        );
      }

      const ctx = (field: string) => `reflection|${date}|${field}`;
      const gratitude = body.gratitude.map((g) => g.trim()).filter(Boolean);
      const values = {
        gratitudeCt: gratitude.length
          ? await this.crypto.encrypt(tx, userId, ctx('gratitude'), JSON.stringify(gratitude))
          : null,
        shortcomingCt: await this.crypto.encrypt(tx, userId, ctx('shortcoming'), body.shortcoming),
        repentanceNoted: body.repentanceNoted,
        intentionCt: await this.crypto.encrypt(tx, userId, ctx('intention'), body.intention),
        freeTextCt: await this.crypto.encrypt(tx, userId, ctx('freeText'), body.freeText),
        // Completing is one-way: saving a draft later never "uncompletes" the day.
        completedAt: body.complete
          ? (existing?.completedAt ?? new Date())
          : (existing?.completedAt ?? null),
      };

      let reflectionId: string;
      if (existing) {
        reflectionId = existing.id;
        await tx
          .update(dailyReflections)
          .set({ ...values, version: sql`${dailyReflections.version} + 1` })
          .where(eq(dailyReflections.id, existing.id));
      } else {
        const [row] = await tx
          .insert(dailyReflections)
          .values({ userId, localDate: date, ...values })
          .returning({ id: dailyReflections.id });
        reflectionId = row!.id;
      }

      // Replace answers. Only the user's own questions count; empty answers are skipped.
      const ownIds = new Set(
        (
          await tx
            .select({ id: reflectionQuestions.id })
            .from(reflectionQuestions)
            .where(
              and(
                eq(reflectionQuestions.userId, userId),
                inArray(
                  reflectionQuestions.id,
                  body.answers.map((a) => a.questionId).concat([randomUUID()]),
                ),
              ),
            )
        ).map((r) => r.id),
      );
      await tx.delete(reflectionAnswers).where(eq(reflectionAnswers.reflectionId, reflectionId));
      const rows = [];
      for (const a of body.answers) {
        const text = a.text?.trim() || null;
        if (!ownIds.has(a.questionId) || (!a.choice && !text)) continue;
        rows.push({
          reflectionId,
          questionId: a.questionId,
          userId,
          choice: a.choice,
          textCt: await this.crypto.encrypt(tx, userId, `answer|${date}|${a.questionId}`, text),
        });
      }
      if (rows.length) await tx.insert(reflectionAnswers).values(rows);
      return (await this.load(tx, userId, date))!;
    });
  }

  async remove(userId: string, date: string): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      await this.prayer.assertWritableDay(tx, userId, date);
      await tx
        .delete(dailyReflections)
        .where(and(eq(dailyReflections.userId, userId), eq(dailyReflections.localDate, date)));
    });
  }

  /** Metadata only (no text), e.g. for calendars and reports. */
  async list(userId: string, from: string, to: string) {
    return withUser(this.handle.db, userId, async (tx) => {
      const rows = await tx
        .select({
          localDate: dailyReflections.localDate,
          completedAt: dailyReflections.completedAt,
          answeredCount: sql<number>`(select count(*)::int from ${reflectionAnswers} where ${reflectionAnswers.reflectionId} = ${dailyReflections.id})`,
        })
        .from(dailyReflections)
        .where(
          and(
            eq(dailyReflections.userId, userId),
            sql`${dailyReflections.localDate} between ${from} and ${to}`,
          ),
        )
        .orderBy(dailyReflections.localDate);
      return rows.map((r) => ({ ...r, completedAt: r.completedAt?.toISOString() ?? null }));
    });
  }

  /** The intention written on `date`, shown on the next day's Today page (REF-6). */
  async intention(
    userId: string,
    date: string,
  ): Promise<{ localDate: string; intention: string | null }> {
    return withUser(this.handle.db, userId, async (tx) => {
      const [r] = await tx
        .select({ intentionCt: dailyReflections.intentionCt })
        .from(dailyReflections)
        .where(and(eq(dailyReflections.userId, userId), eq(dailyReflections.localDate, date)));
      return {
        localDate: date,
        intention: r
          ? await this.crypto.decrypt(tx, userId, `reflection|${date}|intention`, r.intentionCt)
          : null,
      };
    });
  }
}
