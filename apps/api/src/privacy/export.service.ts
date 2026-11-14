import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, schema, withUser, type DbHandle, type Tx } from '@tadhkirah/db';
import { CryptoService } from '../crypto/crypto.service.js';
import { DB } from '../db/db.module.js';

const s = schema;
type Gratitude = string[];

/** Everything we hold about one user, decrypted for them (ACC-5). */
export interface AccountExport {
  format: 'tadhkirah-export';
  version: 1;
  exportedAt: string;
  account: { email: string; createdAt: string };
  profile: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  prayerSettings: Record<string, unknown> | null;
  worship: {
    activities: Record<string, unknown>[];
    logs: {
      date: string;
      activityId: string;
      prayerStatus: string | null;
      done: boolean | null;
      amount: number | null;
    }[];
    dayFlags: { date: string; excused: boolean; travelling: boolean }[];
  };
  quran: {
    recitations: Record<string, unknown>[];
    memorization: Record<string, unknown>[];
    revisions: Record<string, unknown>[];
  };
  reflection: {
    questions: {
      id: string;
      catalogKey: string | null;
      text: string | null;
      answerType: string;
      enabled: boolean;
      archived: boolean;
    }[];
    days: {
      date: string;
      gratitude: Gratitude;
      shortcoming: string | null;
      repentanceNoted: boolean;
      intention: string | null;
      freeText: string | null;
      completedAt: string | null;
      answers: { questionId: string; choice: string | null; text: string | null }[];
    }[];
  };
  weekly: {
    reviews: {
      weekStart: string;
      improved: string | null;
      neglected: string | null;
      madeEasier: string | null;
      changeNext: string | null;
    }[];
    goals: {
      id: string;
      text: string;
      source: string;
      status: string;
      startsOn: string;
      endsOn: string | null;
    }[];
  };
  reminders: {
    preferences: Record<string, unknown> | null;
    rules: Record<string, unknown>[];
    inbox: { category: string; sentAt: string; openedAt: string | null }[];
  };
  devices: {
    label: string | null;
    createdAt: string;
    lastSeenAt: string | null;
    active: boolean;
  }[];
}

/** Removes the owner column and turns dates into ISO strings, so rows are plain JSON. */
function clean<T extends Record<string, unknown>>(
  row: T,
  drop: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'userId' || drop.includes(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

@Injectable()
export class ExportService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly crypto: CryptoService,
  ) {}

  async collect(userId: string): Promise<AccountExport> {
    const [user] = await this.handle.db
      .select({ email: s.users.email, createdAt: s.users.createdAt })
      .from(s.users)
      .where(eq(s.users.id, userId));
    const devices = await this.handle.db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.userId, userId))
      .orderBy(asc(s.sessions.createdAt));

    const data = await withUser(this.handle.db, userId, (tx) => this.collectApp(tx, userId));
    return {
      format: 'tadhkirah-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { email: user!.email, createdAt: user!.createdAt.toISOString() },
      ...data,
      // Token hashes stay private; only what identifies the device to its owner.
      devices: devices.map((d) => ({
        label: d.deviceLabel,
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        active: !d.revokedAt && d.expiresAt > new Date(),
      })),
    };
  }

  private async collectApp(
    tx: Tx,
    userId: string,
  ): Promise<Omit<AccountExport, 'format' | 'version' | 'exportedAt' | 'account' | 'devices'>> {
    const dec = (ctx: string, b: Buffer | null) => this.crypto.decrypt(tx, userId, ctx, b);
    const mine = <T extends { userId: unknown }>(t: T) => eq(t.userId as never, userId);

    const [profile] = await tx.select().from(s.userProfiles).where(mine(s.userProfiles));
    const [preferences] = await tx.select().from(s.userPreferences).where(mine(s.userPreferences));
    const [prayer] = await tx.select().from(s.prayerTimeSettings).where(mine(s.prayerTimeSettings));

    const activities = await tx
      .select()
      .from(s.userActivities)
      .where(mine(s.userActivities))
      .orderBy(asc(s.userActivities.sort));
    const logs = await tx
      .select()
      .from(s.worshipLogs)
      .where(mine(s.worshipLogs))
      .orderBy(asc(s.worshipLogs.localDate));
    const flags = await tx
      .select()
      .from(s.dayFlags)
      .where(mine(s.dayFlags))
      .orderBy(asc(s.dayFlags.localDate));

    const recitations = await tx
      .select()
      .from(s.quranRecitations)
      .where(mine(s.quranRecitations))
      .orderBy(asc(s.quranRecitations.localDate));
    const memorization = await tx
      .select()
      .from(s.quranMemorization)
      .where(mine(s.quranMemorization))
      .orderBy(asc(s.quranMemorization.surah));
    const revisions = await tx
      .select()
      .from(s.quranRevisions)
      .where(mine(s.quranRevisions))
      .orderBy(asc(s.quranRevisions.localDate));

    const questions = await tx
      .select()
      .from(s.reflectionQuestions)
      .where(mine(s.reflectionQuestions))
      .orderBy(asc(s.reflectionQuestions.sort));
    const reflections = await tx
      .select()
      .from(s.dailyReflections)
      .where(mine(s.dailyReflections))
      .orderBy(asc(s.dailyReflections.localDate));
    const answers = await tx.select().from(s.reflectionAnswers).where(mine(s.reflectionAnswers));

    const reviews = await tx
      .select()
      .from(s.weeklyReviews)
      .where(mine(s.weeklyReviews))
      .orderBy(asc(s.weeklyReviews.weekStart));
    const goals = await tx
      .select()
      .from(s.improvementGoals)
      .where(mine(s.improvementGoals))
      .orderBy(asc(s.improvementGoals.startsOn));

    const [notifPrefs] = await tx
      .select()
      .from(s.notificationPreferences)
      .where(mine(s.notificationPreferences));
    const rules = await tx
      .select()
      .from(s.reminderRules)
      .where(mine(s.reminderRules))
      .orderBy(asc(s.reminderRules.createdAt));
    const inbox = await tx
      .select()
      .from(s.notificationLog)
      .where(mine(s.notificationLog))
      .orderBy(asc(s.notificationLog.sentAt));

    const days = [];
    for (const r of reflections) {
      const ctx = (f: string) => `reflection|${r.localDate}|${f}`;
      const gratitude = await dec(ctx('gratitude'), r.gratitudeCt);
      const dayAnswers = [];
      for (const a of answers.filter((x) => x.reflectionId === r.id)) {
        dayAnswers.push({
          questionId: a.questionId,
          choice: a.choice,
          text: await dec(`answer|${r.localDate}|${a.questionId}`, a.textCt),
        });
      }
      days.push({
        date: r.localDate,
        gratitude: gratitude ? (JSON.parse(gratitude) as Gratitude) : [],
        shortcoming: await dec(ctx('shortcoming'), r.shortcomingCt),
        repentanceNoted: r.repentanceNoted,
        intention: await dec(ctx('intention'), r.intentionCt),
        freeText: await dec(ctx('freeText'), r.freeTextCt),
        completedAt: r.completedAt?.toISOString() ?? null,
        answers: dayAnswers,
      });
    }

    const field = (w: string, f: string, b: Buffer | null) => dec(`weekly|${w}|${f}`, b);
    return {
      profile: profile ? clean(profile) : null,
      preferences: preferences ? clean(preferences) : null,
      prayerSettings: prayer ? clean(prayer) : null,
      worship: {
        activities: activities.map((a) => clean(a)),
        logs: logs.map((l) => ({
          date: l.localDate,
          activityId: l.activityId,
          prayerStatus: l.prayerStatus,
          done: l.done,
          amount: l.amount,
        })),
        dayFlags: flags.map((f) => ({
          date: f.localDate,
          excused: f.excused,
          travelling: f.travelling,
        })),
      },
      quran: {
        recitations: recitations.map((r) => clean(r)),
        memorization: memorization.map((m) => clean(m)),
        revisions: revisions.map((r) => clean(r)),
      },
      reflection: {
        questions: await Promise.all(
          questions.map(async (q) => ({
            id: q.id,
            catalogKey: q.catalogKey,
            text: q.textCt ? await dec(`question|${q.id}`, q.textCt) : null,
            answerType: q.answerType,
            enabled: q.enabled,
            archived: !!q.archivedAt,
          })),
        ),
        days,
      },
      weekly: {
        reviews: await Promise.all(
          reviews.map(async (r) => ({
            weekStart: r.weekStart,
            improved: await field(r.weekStart, 'improved', r.improvedCt),
            neglected: await field(r.weekStart, 'neglected', r.neglectedCt),
            madeEasier: await field(r.weekStart, 'madeEasier', r.madeEasierCt),
            changeNext: await field(r.weekStart, 'changeNext', r.changeNextCt),
          })),
        ),
        goals: await Promise.all(
          goals.map(async (g) => ({
            id: g.id,
            text: (await dec(`goal|${g.id}`, g.textCt)) ?? '',
            source: g.source,
            status: g.status,
            startsOn: g.startsOn,
            endsOn: g.endsOn,
          })),
        ),
      },
      reminders: {
        preferences: notifPrefs ? clean(notifPrefs) : null,
        rules: await Promise.all(
          rules.map(async (r) => ({
            ...clean(r, ['customTitleCt']),
            customTitle: r.customTitleCt ? await dec(`reminder|${r.id}`, r.customTitleCt) : null,
          })),
        ),
        inbox: inbox.map((n) => ({
          category: n.category,
          sentAt: n.sentAt.toISOString(),
          openedAt: n.openedAt?.toISOString() ?? null,
        })),
      },
    };
  }
}
