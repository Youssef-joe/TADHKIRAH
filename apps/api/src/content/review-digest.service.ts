import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, schema, sql, type DbHandle } from '@tadhkirah/db';
import { digestDue } from '@tadhkirah/domain';
import { MAILER, type Mailer } from '../auth/mailer.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';
import { reviewDigestEmail } from './review-emails.js';

const { users, userRoles, userProfiles, reviewerDigests, issueReports } = schema;

/**
 * Reminds reviewers about the re-review queue (the verification loop): items
 * whose review date has passed, and open problem reports. Runs with the
 * reminder planner (every 5 minutes) and does nothing most of the time.
 */
@Injectable()
export class ReviewDigestService {
  private readonly logger = new Logger(ReviewDigestService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(ENV) private readonly env: Env,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /** Approved items due now, across all content types (null = never scheduled = due). */
  async dueCount(): Promise<number> {
    const due = (table: string) =>
      sql.raw(
        `(select count(*) from content.${table} where status = 'approved' and (review_due_at is null or review_due_at <= now()))`,
      );
    const r = await this.handle.db.execute(
      sql`select ${due('hadiths')} + ${due('sunnahs')} + ${due('supplication_occasions')} as n`,
    );
    return Number((r.rows[0] as { n: string | number }).n);
  }

  async remindReviewers(now = new Date()): Promise<{ sent: number }> {
    const db = this.handle.db;
    const due = await this.dueCount();
    const [reports] = await db
      .select({
        open: sql<number>`count(*)::int`,
        newest: sql<Date | null>`max(${issueReports.createdAt})`,
      })
      .from(issueReports)
      .where(sql`${issueReports.resolvedAt} is null`);
    const openReports = reports?.open ?? 0;
    if (!due && !openReports) return { sent: 0 };
    const newestReportAt = reports?.newest ? new Date(reports.newest) : null;

    const reviewers = await db
      .selectDistinct({
        id: users.id,
        email: users.email,
        locale: userProfiles.locale,
        lastSentAt: reviewerDigests.lastSentAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(reviewerDigests, eq(reviewerDigests.userId, users.id))
      .where(and(inArray(userRoles.role, ['reviewer']), eq(users.status, 'active')));

    let sent = 0;
    for (const r of reviewers) {
      const lastSentAt = r.lastSentAt ? new Date(r.lastSentAt) : null;
      if (!digestDue({ now, lastSentAt, dueCount: due, openReports, newestReportAt })) continue;
      // Claim the send first, so overlapping runs never email twice.
      const claimed = await db
        .insert(reviewerDigests)
        .values({ userId: r.id, lastSentAt: now })
        .onConflictDoUpdate({
          target: reviewerDigests.userId,
          set: { lastSentAt: now },
          where: lastSentAt
            ? sql`${reviewerDigests.lastSentAt} = ${lastSentAt.toISOString()}::timestamptz`
            : sql`false`,
        })
        .returning({ userId: reviewerDigests.userId });
      if (!claimed.length) continue;
      const locale = r.locale ?? 'ar';
      try {
        await this.mailer.send(
          reviewDigestEmail(
            r.email,
            locale,
            { due, reports: openReports },
            `${this.env.PUBLIC_WEB_URL}/${locale}/admin/review`,
          ),
        );
        sent++;
      } catch (err) {
        this.logger.error(`review digest failed: ${(err as Error).message}`);
      }
    }
    if (sent) this.logger.log({ sent, due, openReports }, 'sent review digests');
    return { sent };
  }
}
