import { Inject, Injectable } from '@nestjs/common';
import type {
  Grade,
  PublicDifference,
  PublicHadith,
  PublicOccasion,
  PublicSunnah,
} from '@tadhkirah/contracts';
import { schema, sql, type DbHandle } from '@tadhkirah/db';
import { AppError } from '../common/http.js';
import { DB } from '../db/db.module.js';

type Row = Record<string, unknown>;

/**
 * Public content API (CON-9). Reads ONLY the published_* views from migration
 * 0016, which enforce the publication gate in the database: an item appears only
 * when it and every hadith it cites are approved with a sahih/hasan primary grading.
 */
@Injectable()
export class PublicContentService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  private async rows(query: ReturnType<typeof sql>): Promise<Row[]> {
    return (await this.handle.db.execute(query)).rows as Row[];
  }

  async sunnahs(slug?: string): Promise<PublicSunnah[]> {
    const items = await this.rows(
      slug
        ? sql`select * from content.published_sunnahs where slug = ${slug}`
        : sql`select * from content.published_sunnahs order by trigger, title_en`,
    );
    if (slug && !items.length) throw new AppError(404, 'not_found');
    const evidence = await this.evidence(
      'sunnah',
      items.map((i) => String(i.id)),
    );
    return items.map((i) => ({
      id: String(i.id),
      slug: String(i.slug),
      titleAr: String(i.title_ar),
      titleEn: String(i.title_en),
      descriptionAr: String(i.description_ar),
      descriptionEn: String(i.description_en),
      instructionsAr: (i.instructions_ar as string | null) ?? null,
      instructionsEn: (i.instructions_en as string | null) ?? null,
      classification: i.classification as PublicSunnah['classification'],
      trigger: i.trigger as PublicSunnah['trigger'],
      hadiths: evidence.hadiths.get(String(i.id)) ?? [],
      differences: evidence.differences.get(String(i.id)) ?? [],
    }));
  }

  async occasions(slug?: string): Promise<PublicOccasion[]> {
    const items = await this.rows(
      slug
        ? sql`select * from content.published_occasions where slug = ${slug}`
        : sql`select * from content.published_occasions order by schedulable desc, title_en`,
    );
    if (slug && !items.length) throw new AppError(404, 'not_found');
    const evidence = await this.evidence(
      'occasion',
      items.map((i) => String(i.id)),
    );
    return items.map((i) => ({
      id: String(i.id),
      slug: String(i.slug),
      titleAr: String(i.title_ar),
      titleEn: String(i.title_en),
      explanationAr: String(i.explanation_ar),
      explanationEn: String(i.explanation_en),
      window: i.window as PublicOccasion['window'],
      evidenceType: i.evidence_type as PublicOccasion['evidenceType'],
      schedulable: Boolean(i.schedulable),
      hadiths: evidence.hadiths.get(String(i.id)) ?? [],
      differences: evidence.differences.get(String(i.id)) ?? [],
    }));
  }

  /** The cited hadiths (from published_hadiths only), their gradings, and every scholarly difference. */
  private async evidence(subject: 'sunnah' | 'occasion', ids: string[]) {
    const hadiths = new Map<string, PublicHadith[]>();
    const differences = new Map<string, PublicDifference[]>();
    if (!ids.length) return { hadiths, differences };
    const idList = sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const link = subject === 'sunnah' ? sql`content.sunnah_hadiths` : sql`content.occasion_hadiths`;
    const owner = subject === 'sunnah' ? sql`l.sunnah_id` : sql`l.occasion_id`;

    const cited = await this.rows(sql`
      select ${owner} as owner_id, l.relevance, h.id, h.number, h.text_ar, h.is_excerpt, h.translation_en,
             h.translation_by, h.source_url, s.key as source_key, s.name_ar as source_ar, s.name_en as source_en,
             s.numbering_scheme, n.name_ar as narrator_ar, n.name_en as narrator_en
      from ${link} l
      join content.published_hadiths h on h.id = l.hadith_id
      join content.hadith_sources s on s.id = h.source_id
      left join content.narrators n on n.id = h.narrator_id
      where ${owner} in (${idList})
      order by s.key, h.number`);
    const hadithIds = [...new Set(cited.map((r) => String(r.id)))];

    const gradings = new Map<string, Row[]>();
    const hadithDiffs = new Map<string, PublicDifference[]>();
    if (hadithIds.length) {
      const hList = sql.join(
        hadithIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      for (const g of await this.rows(
        sql`select * from content.hadith_authentications where hadith_id in (${hList}) order by is_primary desc, created_at`,
      )) {
        gradings.set(String(g.hadith_id), [...(gradings.get(String(g.hadith_id)) ?? []), g]);
      }
      for (const d of await this.rows(
        sql`select * from content.scholarly_differences where subject_type = 'hadith' and subject_id in (${hList}) order by created_at`,
      )) {
        hadithDiffs.set(String(d.subject_id), [
          ...(hadithDiffs.get(String(d.subject_id)) ?? []),
          toDifference(d),
        ]);
      }
    }
    for (const r of cited) {
      const [primary, ...others] = gradings.get(String(r.id)) ?? [];
      if (!primary) continue; // the view guarantees one; never show an ungraded narration
      const h: PublicHadith = {
        id: String(r.id),
        textAr: String(r.text_ar),
        isExcerpt: Boolean(r.is_excerpt),
        translationEn: (r.translation_en as string | null) ?? null,
        translationBy: (r.translation_by as string | null) ?? null,
        narrator: r.narrator_ar
          ? { nameAr: String(r.narrator_ar), nameEn: String(r.narrator_en) }
          : null,
        source: {
          key: String(r.source_key),
          nameAr: String(r.source_ar),
          nameEn: String(r.source_en),
          numberingScheme: String(r.numbering_scheme),
        },
        number: String(r.number),
        url: String(r.source_url),
        grade: primary.grade as Grade,
        gradedBy: String(primary.scholar),
        workCited: String(primary.work_cited),
        otherGradings: others.map((g) => ({
          grade: g.grade as Grade,
          scholar: String(g.scholar),
          workCited: String(g.work_cited),
        })),
        relevance: (r.relevance as string | null) ?? null,
        differences: hadithDiffs.get(String(r.id)) ?? [],
      };
      hadiths.set(String(r.owner_id), [...(hadiths.get(String(r.owner_id)) ?? []), h]);
    }
    for (const d of await this.rows(
      sql`select * from content.scholarly_differences where subject_type = ${subject} and subject_id in (${idList}) order by created_at`,
    )) {
      differences.set(String(d.subject_id), [
        ...(differences.get(String(d.subject_id)) ?? []),
        toDifference(d),
      ]);
    }
    return { hadiths, differences };
  }

  /** "Report a problem with this source" (rate-limited by the controller). */
  async report(
    userId: string,
    subjectType: 'hadith' | 'sunnah' | 'occasion',
    subjectId: string,
    message: string,
  ) {
    await this.handle.db
      .insert(schema.issueReports)
      .values({ subjectType, subjectId, message, reportedBy: userId });
  }
}

function toDifference(d: Row): PublicDifference {
  return {
    kind: d.kind as PublicDifference['kind'],
    summaryAr: String(d.summary_ar),
    summaryEn: String(d.summary_en),
  };
}
