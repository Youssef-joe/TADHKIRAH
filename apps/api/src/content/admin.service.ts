import { Inject, Injectable } from '@nestjs/common';
import type { ContentAction, ContentType, EditorialRole } from '@tadhkirah/contracts';
import {
  AuthenticationInputSchema,
  DifferenceInputSchema,
  HadithInputSchema,
  HadithPatchSchema,
  LinksInputSchema,
  OccasionInputSchema,
  OccasionPatchSchema,
  SunnahInputSchema,
  SourceInputSchema,
  SunnahPatchSchema,
} from '@tadhkirah/contracts';
import { and, asc, desc, eq, inArray, schema, sql, type DbHandle, type Tx } from '@tadhkirah/db';
import {
  availableActions,
  checkTransition,
  hadithGate,
  hadithProblems,
  isEditable,
  itemGate,
  itemProblems,
  type ContentStatus,
  type Grade,
} from '@tadhkirah/domain';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';
import { CANDIDATE_LEADS } from './candidates.js';
import { RolesService } from './roles.service.js';

const c = schema;
type Subject = 'hadith' | 'sunnah' | 'occasion';
const SUBJECT: Record<ContentType, Subject> = {
  hadiths: 'hadith',
  sunnahs: 'sunnah',
  occasions: 'occasion',
};

/** HTTP status for each workflow refusal. */
const ERROR_STATUS: Record<string, number> = {
  'content.transition_not_allowed': 409,
  forbidden: 403,
  'content.reviewer_is_author': 403,
  'content.incomplete': 422,
  'content.grade_not_publishable': 422,
  'content.evidence_not_published': 422,
};

/**
 * Editorial back office (CON-1…CON-10). Everything here runs as the database
 * owner on the `content` schema; access is decided by editorial roles. The
 * public API never reads these tables, only the published views.
 */
@Injectable()
export class ContentAdminService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(ENV) private readonly env: Env,
    private readonly roles: RolesService,
  ) {}

  private get db() {
    return this.handle.db;
  }

  get twoPersonRule(): boolean {
    return this.env.CONTENT_TWO_PERSON_RULE;
  }

  // ── Reference data ────────────────────────────────────────────────────────
  sources() {
    return this.db.select().from(c.hadithSources).orderBy(asc(c.hadithSources.createdAt));
  }
  narrators() {
    return this.db.select().from(c.narrators).orderBy(asc(c.narrators.nameEn));
  }
  async addNarrator(body: { nameAr: string; nameEn: string }) {
    const [row] = await this.db.insert(c.narrators).values(body).returning();
    return row!;
  }
  async addSource(body: z.output<typeof SourceInputSchema>) {
    const [row] = await this.db
      .insert(c.hadithSources)
      .values({ ...body, baseUrl: body.baseUrl ?? null })
      .onConflictDoNothing()
      .returning();
    if (!row)
      throw new AppError(409, 'content.duplicate', 'A source with this key already exists.');
    return row;
  }

  // ── Lists and detail ──────────────────────────────────────────────────────
  async list(type: ContentType, status?: ContentStatus, q?: string) {
    const like = q ? `%${q.trim()}%` : null;
    if (type === 'hadiths') {
      return this.db
        .select({
          id: c.hadiths.id,
          status: c.hadiths.status,
          revision: c.hadiths.revision,
          number: c.hadiths.number,
          sourceKey: c.hadithSources.key,
          sourceNameEn: c.hadithSources.nameEn,
          sourceNameAr: c.hadithSources.nameAr,
          narratorEn: c.narrators.nameEn,
          narratorAr: c.narrators.nameAr,
          hasText: sql<boolean>`coalesce(btrim(${c.hadiths.textAr}), '') <> ''`,
          updatedAt: c.hadiths.updatedAt,
        })
        .from(c.hadiths)
        .innerJoin(c.hadithSources, eq(c.hadithSources.id, c.hadiths.sourceId))
        .leftJoin(c.narrators, eq(c.narrators.id, c.hadiths.narratorId))
        .where(
          and(
            status ? eq(c.hadiths.status, status) : undefined,
            like
              ? sql`(${c.hadiths.number} ilike ${like} or ${c.hadiths.textAr} ilike ${like} or ${c.narrators.nameEn} ilike ${like} or ${c.narrators.nameAr} ilike ${like})`
              : undefined,
          ),
        )
        .orderBy(asc(c.hadithSources.key), asc(c.hadiths.number), desc(c.hadiths.revision))
        .limit(500);
    }
    const t = type === 'sunnahs' ? c.sunnahs : c.supplicationOccasions;
    return this.db
      .select({
        id: t.id,
        status: t.status,
        revision: t.revision,
        slug: t.slug,
        titleAr: t.titleAr,
        titleEn: t.titleEn,
        updatedAt: t.updatedAt,
      })
      .from(t)
      .where(
        and(
          status ? eq(t.status, status) : undefined,
          like
            ? sql`(${t.slug} ilike ${like} or ${t.titleAr} ilike ${like} or ${t.titleEn} ilike ${like})`
            : undefined,
        ),
      )
      .orderBy(asc(t.slug), desc(t.revision))
      .limit(500);
  }

  async detail(userId: string, type: ContentType, id: string) {
    const roles = await this.roles.rolesOf(userId);
    const row = await this.find(this.db, type, id);
    const subject = SUBJECT[type];
    const differences = await this.db
      .select()
      .from(c.scholarlyDifferences)
      .where(
        and(
          eq(c.scholarlyDifferences.subjectType, subject),
          eq(c.scholarlyDifferences.subjectId, id),
        ),
      )
      .orderBy(asc(c.scholarlyDifferences.createdAt));
    const history = await this.history(subject, id);
    const extra =
      type === 'hadiths'
        ? {
            authentications: await this.db
              .select()
              .from(c.hadithAuthentications)
              .where(eq(c.hadithAuthentications.hadithId, id))
              .orderBy(
                desc(c.hadithAuthentications.isPrimary),
                asc(c.hadithAuthentications.createdAt),
              ),
          }
        : { links: await this.links(type, id) };
    const problems = await this.problems(this.db, type, row);
    return {
      item: row,
      ...extra,
      differences,
      history,
      problems,
      actions: availableActions(row.status, roles),
      editable: isEditable(row.status),
      twoPersonRule: this.env.CONTENT_TWO_PERSON_RULE,
    };
  }

  private async links(type: ContentType, id: string) {
    const l = type === 'sunnahs' ? c.sunnahHadiths : c.occasionHadiths;
    const owner = type === 'sunnahs' ? c.sunnahHadiths.sunnahId : c.occasionHadiths.occasionId;
    return this.db
      .select({
        hadithId: l.hadithId,
        relevance: l.relevance,
        status: c.hadiths.status,
        number: c.hadiths.number,
        sourceKey: c.hadithSources.key,
        sourceNameEn: c.hadithSources.nameEn,
        sourceNameAr: c.hadithSources.nameAr,
      })
      .from(l)
      .innerJoin(c.hadiths, eq(c.hadiths.id, l.hadithId))
      .innerJoin(c.hadithSources, eq(c.hadithSources.id, c.hadiths.sourceId))
      .where(eq(owner, id));
  }

  history(subject: Subject, id: string) {
    return this.db
      .select({
        id: c.reviewRecords.id,
        action: c.reviewRecords.action,
        fromStatus: c.reviewRecords.fromStatus,
        toStatus: c.reviewRecords.toStatus,
        revision: c.reviewRecords.subjectRevision,
        actorRole: c.reviewRecords.actorRole,
        actorEmail: c.users.email,
        singleReviewer: c.reviewRecords.singleReviewer,
        notes: c.reviewRecords.notes,
        createdAt: c.reviewRecords.createdAt,
      })
      .from(c.reviewRecords)
      .leftJoin(c.users, eq(c.users.id, c.reviewRecords.actorUserId))
      .where(and(eq(c.reviewRecords.subjectType, subject), eq(c.reviewRecords.subjectId, id)))
      .orderBy(asc(c.reviewRecords.createdAt));
  }

  // ── Create and edit drafts ────────────────────────────────────────────────
  async createHadith(userId: string, body: z.output<typeof HadithInputSchema>) {
    const [row] = await this.db
      .insert(c.hadiths)
      .values({ ...body, isExcerpt: body.isExcerpt ?? false, createdBy: userId, updatedBy: userId })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new AppError(409, 'content.duplicate', 'This source and number already exist.');
    return row;
  }

  async createSunnah(userId: string, body: z.output<typeof SunnahInputSchema>) {
    await this.assertSlugFree('sunnahs', body.slug);
    const [row] = await this.db
      .insert(c.sunnahs)
      .values({ ...body, createdBy: userId, updatedBy: userId })
      .returning();
    return row!;
  }

  async createOccasion(userId: string, body: z.output<typeof OccasionInputSchema>) {
    await this.assertSlugFree('occasions', body.slug);
    const [row] = await this.db
      .insert(c.supplicationOccasions)
      .values({ ...body, createdBy: userId, updatedBy: userId })
      .returning();
    return row!;
  }

  private async assertSlugFree(type: 'sunnahs' | 'occasions', slug: string) {
    const t = type === 'sunnahs' ? c.sunnahs : c.supplicationOccasions;
    const [taken] = await this.db.select({ id: t.id }).from(t).where(eq(t.slug, slug)).limit(1);
    if (taken) throw new AppError(409, 'content.duplicate', 'This slug is already used.');
  }

  async patch(
    userId: string,
    type: ContentType,
    id: string,
    body:
      | z.output<typeof HadithPatchSchema>
      | z.output<typeof SunnahPatchSchema>
      | z.output<typeof OccasionPatchSchema>,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await this.find(tx, type, id, true);
      this.assertEditable(row.status);
      if ('slug' in body && body.slug && body.slug !== (row as { slug?: string }).slug) {
        throw new AppError(422, 'content.slug_fixed', 'The slug cannot change once created.');
      }
      const t = this.table(type);
      const [updated] = await tx
        .update(t)
        .set({ ...(body as Record<string, unknown>), updatedBy: userId })
        .where(eq(t.id, id))
        .returning();
      return updated!;
    });
  }

  async addAuthentication(
    userId: string,
    hadithId: string,
    body: z.output<typeof AuthenticationInputSchema>,
  ) {
    return this.db.transaction(async (tx) => {
      const h = await this.find(tx, 'hadiths', hadithId, true);
      this.assertEditable(h.status);
      // Exactly one primary grading: a new primary replaces the old flag.
      if (body.isPrimary) {
        await tx
          .update(c.hadithAuthentications)
          .set({ isPrimary: false })
          .where(eq(c.hadithAuthentications.hadithId, hadithId));
      }
      const [row] = await tx
        .insert(c.hadithAuthentications)
        .values({ ...body, notes: body.notes ?? null, hadithId, createdBy: userId })
        .returning();
      await tx.update(c.hadiths).set({ updatedBy: userId }).where(eq(c.hadiths.id, hadithId));
      return row!;
    });
  }

  async removeAuthentication(userId: string, hadithId: string, authId: string) {
    await this.db.transaction(async (tx) => {
      const h = await this.find(tx, 'hadiths', hadithId, true);
      this.assertEditable(h.status);
      await tx
        .delete(c.hadithAuthentications)
        .where(
          and(
            eq(c.hadithAuthentications.id, authId),
            eq(c.hadithAuthentications.hadithId, hadithId),
          ),
        );
      await tx.update(c.hadiths).set({ updatedBy: userId }).where(eq(c.hadiths.id, hadithId));
    });
  }

  async addDifference(
    userId: string,
    type: ContentType,
    id: string,
    body: z.output<typeof DifferenceInputSchema>,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await this.find(tx, type, id, true);
      this.assertEditable(row.status);
      const [d] = await tx
        .insert(c.scholarlyDifferences)
        .values({ ...body, subjectType: SUBJECT[type], subjectId: id, createdBy: userId })
        .returning();
      return d!;
    });
  }

  async removeDifference(type: ContentType, id: string, differenceId: string) {
    await this.db.transaction(async (tx) => {
      const row = await this.find(tx, type, id, true);
      this.assertEditable(row.status);
      await tx
        .delete(c.scholarlyDifferences)
        .where(
          and(
            eq(c.scholarlyDifferences.id, differenceId),
            eq(c.scholarlyDifferences.subjectId, id),
          ),
        );
    });
  }

  /** Replaces the hadiths a Sunnah or occasion cites as its evidence. */
  async setLinks(
    userId: string,
    type: 'sunnahs' | 'occasions',
    id: string,
    body: z.output<typeof LinksInputSchema>,
  ) {
    await this.db.transaction(async (tx) => {
      const row = await this.find(tx, type, id, true);
      this.assertEditable(row.status);
      const ids = [...new Set(body.links.map((l) => l.hadithId))];
      if (ids.length) {
        const found = await tx
          .select({ id: c.hadiths.id })
          .from(c.hadiths)
          .where(inArray(c.hadiths.id, ids));
        if (found.length !== ids.length)
          throw new AppError(422, 'content.unknown_hadith', 'A linked hadith does not exist.');
      }
      if (type === 'sunnahs') {
        await tx.delete(c.sunnahHadiths).where(eq(c.sunnahHadiths.sunnahId, id));
        if (ids.length) {
          await tx
            .insert(c.sunnahHadiths)
            .values(
              body.links.map((l) => ({
                sunnahId: id,
                hadithId: l.hadithId,
                relevance: l.relevance ?? null,
              })),
            )
            .onConflictDoNothing();
        }
        await tx.update(c.sunnahs).set({ updatedBy: userId }).where(eq(c.sunnahs.id, id));
      } else {
        await tx.delete(c.occasionHadiths).where(eq(c.occasionHadiths.occasionId, id));
        if (ids.length) {
          await tx
            .insert(c.occasionHadiths)
            .values(
              body.links.map((l) => ({
                occasionId: id,
                hadithId: l.hadithId,
                relevance: l.relevance ?? null,
              })),
            )
            .onConflictDoNothing();
        }
        await tx
          .update(c.supplicationOccasions)
          .set({ updatedBy: userId })
          .where(eq(c.supplicationOccasions.id, id));
      }
    });
  }

  // ── Workflow ──────────────────────────────────────────────────────────────
  async transition(
    userId: string,
    sessionId: string,
    type: ContentType,
    id: string,
    action: ContentAction,
    notes?: string | null,
  ) {
    const roles = await this.roles.rolesOf(userId);
    if (action !== 'submit' && action !== 'reopen') await this.roles.requireFreshSession(sessionId);

    return this.db.transaction(async (tx) => {
      const row = await this.find(tx, type, id, true);
      const { problems, gate } = await this.problems(tx, type, row);
      const result = checkTransition({
        action,
        status: row.status,
        actorId: userId,
        actorRoles: roles,
        authorId: row.createdBy,
        twoPersonRule: this.env.CONTENT_TWO_PERSON_RULE,
        incomplete: problems,
        gateError: gate,
      });
      if (!result.ok) {
        throw new AppError(
          ERROR_STATUS[result.error] ?? 409,
          result.error,
          'This step is not allowed.',
          {
            ...(result.details ? { errors: { missing: result.details } } : {}),
          },
        );
      }

      const t = this.table(type);
      // A new revision replaces the published one: archive the old, move citations to the new.
      if (result.to === 'approved' && row.supersedesId) {
        const old = await this.find(tx, type, row.supersedesId, true);
        if (old.status === 'approved') {
          await tx.update(t).set({ status: 'archived', updatedBy: userId }).where(eq(t.id, old.id));
          await this.record(
            tx,
            SUBJECT[type],
            old,
            'archive',
            'approved',
            'archived',
            userId,
            result.actorRole,
            false,
            `Replaced by revision ${row.revision}`,
          );
        }
        if (type === 'hadiths') {
          await tx
            .update(c.sunnahHadiths)
            .set({ hadithId: id })
            .where(eq(c.sunnahHadiths.hadithId, old.id));
          await tx
            .update(c.occasionHadiths)
            .set({ hadithId: id })
            .where(eq(c.occasionHadiths.hadithId, old.id));
        }
      }
      await tx.update(t).set({ status: result.to, updatedBy: userId }).where(eq(t.id, id));
      await this.record(
        tx,
        SUBJECT[type],
        row,
        action,
        row.status,
        result.to,
        userId,
        result.actorRole,
        result.singleReviewer,
        notes ?? null,
      );
      return { status: result.to, singleReviewer: result.singleReviewer };
    });
  }

  /** Editing published content makes a new draft revision that goes through review again. */
  async revise(userId: string, type: ContentType, id: string) {
    return this.db.transaction(async (tx) => {
      const row = await this.find(tx, type, id, true);
      if (row.status !== 'approved')
        throw new AppError(
          409,
          'content.transition_not_allowed',
          'Only published items are revised.',
        );
      const t = this.table(type);
      const [pending] = await tx
        .select({ id: t.id })
        .from(t)
        .where(eq(t.supersedesId, id))
        .limit(1);
      if (pending)
        throw new AppError(409, 'content.revision_exists', 'A revision is already in progress.', {
          id: pending.id,
        });

      const {
        id: _id,
        createdAt: _c,
        updatedAt: _u,
        status: _s,
        ...copy
      } = row as Record<string, unknown> & { id: string };
      const [draft] = await tx
        .insert(t)
        .values({
          ...(copy as object),
          revision: row.revision + 1,
          supersedesId: id,
          status: 'draft',
          createdBy: userId,
          updatedBy: userId,
        } as never)
        .returning();
      const newId = (draft as { id: string }).id;

      if (type === 'hadiths') {
        const auths = await tx
          .select()
          .from(c.hadithAuthentications)
          .where(eq(c.hadithAuthentications.hadithId, id));
        if (auths.length) {
          await tx
            .insert(c.hadithAuthentications)
            .values(auths.map(({ id: _a, createdAt: _ca, ...a }) => ({ ...a, hadithId: newId })));
        }
      } else if (type === 'sunnahs') {
        const links = await tx
          .select()
          .from(c.sunnahHadiths)
          .where(eq(c.sunnahHadiths.sunnahId, id));
        if (links.length)
          await tx.insert(c.sunnahHadiths).values(links.map((l) => ({ ...l, sunnahId: newId })));
      } else {
        const links = await tx
          .select()
          .from(c.occasionHadiths)
          .where(eq(c.occasionHadiths.occasionId, id));
        if (links.length)
          await tx
            .insert(c.occasionHadiths)
            .values(links.map((l) => ({ ...l, occasionId: newId })));
      }
      const diffs = await tx
        .select()
        .from(c.scholarlyDifferences)
        .where(
          and(
            eq(c.scholarlyDifferences.subjectType, SUBJECT[type]),
            eq(c.scholarlyDifferences.subjectId, id),
          ),
        );
      if (diffs.length) {
        await tx
          .insert(c.scholarlyDifferences)
          .values(diffs.map(({ id: _d, createdAt: _cd, ...d }) => ({ ...d, subjectId: newId })));
      }
      return { id: newId };
    });
  }

  // ── Issue reports ─────────────────────────────────────────────────────────
  issueReports() {
    return this.db
      .select()
      .from(c.issueReports)
      .orderBy(asc(c.issueReports.resolvedAt), desc(c.issueReports.createdAt))
      .limit(200);
  }
  async resolveIssue(userId: string, id: string) {
    await this.db
      .update(c.issueReports)
      .set({ resolvedAt: sql`now()`, resolvedBy: userId })
      .where(and(eq(c.issueReports.id, id), sql`${c.issueReports.resolvedAt} is null`));
  }

  /**
   * Loads the research leads from docs/07-content-candidates.md as hadith DRAFTS:
   * source, number, narrator and the reviewer notes only. No text: a person enters
   * it from the primary source. Safe to run again (existing source+number are skipped).
   */
  async importCandidates(userId: string): Promise<{ created: number; skipped: number }> {
    return this.db.transaction(async (tx) => {
      const sources = new Map((await tx.select().from(c.hadithSources)).map((s) => [s.key, s]));
      const narrators = new Map((await tx.select().from(c.narrators)).map((n) => [n.nameEn, n]));
      let created = 0;
      let skipped = 0;
      for (const lead of CANDIDATE_LEADS) {
        const source = sources.get(lead.source);
        if (!source) continue;
        let narrator = narrators.get(lead.narrator.en);
        if (!narrator) {
          [narrator] = await tx
            .insert(c.narrators)
            .values({ nameAr: lead.narrator.ar, nameEn: lead.narrator.en })
            .returning();
          narrators.set(lead.narrator.en, narrator!);
        }
        const [row] = await tx
          .insert(c.hadiths)
          .values({
            sourceId: source.id,
            number: lead.number,
            narratorId: narrator!.id,
            sourceUrl: `${source.baseUrl}:${lead.number}`,
            editorNotes: `AI-gathered lead, UNVERIFIED (docs/07-content-candidates.md). ${lead.note} Enter the text from the primary source and confirm the number, narrator, link and grading.`,
            createdBy: userId,
            updatedBy: userId,
          })
          .onConflictDoNothing()
          .returning({ id: c.hadiths.id });
        if (row) created++;
        else skipped++;
      }
      return { created, skipped };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private table(type: ContentType) {
    return type === 'hadiths'
      ? c.hadiths
      : type === 'sunnahs'
        ? c.sunnahs
        : c.supplicationOccasions;
  }

  private async find(tx: Tx | DbHandle['db'], type: ContentType, id: string, lock = false) {
    const t = this.table(type);
    const q = tx.select().from(t).where(eq(t.id, id));
    const [row] = await (lock ? q.for('update') : q);
    if (!row) throw new AppError(404, 'not_found');
    return row as typeof row & {
      status: ContentStatus;
      revision: number;
      createdBy: string | null;
      supersedesId: string | null;
    };
  }

  private assertEditable(status: ContentStatus) {
    if (!isEditable(status)) {
      throw new AppError(
        409,
        'content.not_editable',
        'Only drafts can be edited. Reopen it, or create a new revision.',
      );
    }
  }

  /** What's missing before submit, and what blocks publication. */
  private async problems(
    tx: Tx | DbHandle['db'],
    type: ContentType,
    row: Record<string, unknown> & { id: string },
  ) {
    if (type === 'hadiths') {
      const auths = await tx
        .select({
          grade: c.hadithAuthentications.grade,
          isPrimary: c.hadithAuthentications.isPrimary,
        })
        .from(c.hadithAuthentications)
        .where(eq(c.hadithAuthentications.hadithId, row.id));
      const h = {
        textAr: row.textAr as string | null,
        sourceUrl: row.sourceUrl as string | null,
        narratorId: row.narratorId as string | null,
        authentications: auths as { grade: Grade; isPrimary: boolean }[],
      };
      return { problems: hadithProblems(h), gate: hadithGate(h) };
    }
    const l = type === 'sunnahs' ? c.sunnahHadiths : c.occasionHadiths;
    const owner = type === 'sunnahs' ? c.sunnahHadiths.sunnahId : c.occasionHadiths.occasionId;
    const linked = await tx
      .select({ status: c.hadiths.status })
      .from(l)
      .innerJoin(c.hadiths, eq(c.hadiths.id, l.hadithId))
      .where(eq(owner, row.id));
    const [bodyAr, bodyEn] =
      type === 'sunnahs'
        ? [row.descriptionAr, row.descriptionEn]
        : [row.explanationAr, row.explanationEn];
    const item = {
      titleAr: String(row.titleAr ?? ''),
      titleEn: String(row.titleEn ?? ''),
      body: String(bodyAr ?? '').trim() && String(bodyEn ?? '').trim() ? 'ok' : '',
      linked: linked.map((x) => x.status),
    };
    return { problems: itemProblems(item), gate: itemGate(item) };
  }

  private async record(
    tx: Tx,
    subject: Subject,
    row: { id: string; revision: number },
    action: string,
    from: ContentStatus,
    to: ContentStatus,
    actorId: string,
    role: EditorialRole,
    singleReviewer: boolean,
    notes: string | null,
  ) {
    await tx.insert(c.reviewRecords).values({
      subjectType: subject,
      subjectId: row.id,
      subjectRevision: row.revision,
      action,
      fromStatus: from,
      toStatus: to,
      actorUserId: actorId,
      actorRole: role,
      singleReviewer,
      notes,
    });
  }
}
