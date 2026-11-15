import { z } from 'zod';

export const ContentStatusSchema = z.enum([
  'draft',
  'awaiting_verification',
  'verified',
  'approved',
  'rejected',
  'archived',
]);
export const EditorialRoleSchema = z.enum(['admin', 'editor', 'reviewer', 'publisher']);
export const ContentActionSchema = z.enum([
  'submit',
  'verify',
  'reject',
  'approve',
  'archive',
  'reopen',
]);
export const GradeSchema = z.enum([
  'sahih',
  'hasan',
  'sahih_li_ghayrihi',
  'hasan_li_ghayrihi',
  'daif',
  'mawdu',
]);
export const ContentTypeSchema = z.enum(['hadiths', 'sunnahs', 'occasions']);
export const SubjectTypeSchema = z.enum(['hadith', 'sunnah', 'occasion']);
export const SunnahTriggerSchema = z.enum([
  'daily',
  'on_waking',
  'before_sleep',
  'eating',
  'entering_mosque',
  'friday',
]);
export const OccasionWindowSchema = z.enum([
  'last_third_of_night',
  'jumuah_imam_to_prayer',
  'friday_last_hour_after_asr',
  'between_adhan_iqamah',
  'in_sujud',
  'anytime',
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type EditorialRole = z.infer<typeof EditorialRoleSchema>;
export type ContentAction = z.infer<typeof ContentActionSchema>;
export type Grade = z.infer<typeof GradeSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);

// ── Admin inputs ─────────────────────────────────────────────────────────────
export const NarratorInputSchema = z.object({ nameAr: text(200).min(1), nameEn: text(200).min(1) });
export const SourceInputSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/)
    .max(40),
  nameAr: text(200).min(1),
  nameEn: text(200).min(1),
  numberingScheme: text(80).min(1),
  baseUrl: z.url().max(300).nullable().optional(),
});

export const HadithInputSchema = z.object({
  sourceId: z.uuid(),
  number: text(40).min(1),
  bookChapter: optionalText(300),
  narratorId: z.uuid().nullable().optional(),
  textAr: optionalText(10_000),
  isExcerpt: z.boolean().optional(),
  translationEn: optionalText(10_000),
  translationBy: optionalText(300),
  sourceUrl: z.url().max(500).nullable().optional(),
  editorNotes: optionalText(4000),
});
export const HadithPatchSchema = HadithInputSchema.partial().strict();

export const AuthenticationInputSchema = z.object({
  grade: GradeSchema,
  scholar: text(200).min(1),
  workCited: text(300).min(1),
  isPrimary: z.boolean().default(false),
  notes: optionalText(2000),
});

export const DifferenceInputSchema = z.object({
  kind: z.enum(['authentication', 'interpretation', 'timing']),
  summaryAr: text(4000).min(1),
  summaryEn: text(4000).min(1),
});

export const SunnahInputSchema = z.object({
  slug,
  titleAr: text(200).min(1),
  titleEn: text(200).min(1),
  descriptionAr: text(4000).default(''),
  descriptionEn: text(4000).default(''),
  instructionsAr: optionalText(4000),
  instructionsEn: optionalText(4000),
  classification: z.enum(['established', 'less_commonly_practiced']).default('established'),
  trigger: SunnahTriggerSchema.default('daily'),
});
export const SunnahPatchSchema = SunnahInputSchema.partial().strict();

export const OccasionInputSchema = z.object({
  slug,
  titleAr: text(200).min(1),
  titleEn: text(200).min(1),
  explanationAr: text(4000).default(''),
  explanationEn: text(4000).default(''),
  window: OccasionWindowSchema,
  evidenceType: z.enum(['explicit_text', 'scholarly_interpretation']).default('explicit_text'),
  schedulable: z.boolean().default(true),
});
export const OccasionPatchSchema = OccasionInputSchema.partial().strict();

export const LinksInputSchema = z.object({
  links: z.array(z.object({ hadithId: z.uuid(), relevance: optionalText(500) })).max(20),
});
export const TransitionInputSchema = z.object({
  action: ContentActionSchema,
  notes: optionalText(4000),
});
export const RoleChangeSchema = z.object({
  email: z.email().max(320),
  role: EditorialRoleSchema,
  grant: z.boolean(),
});
export const IssueReportInputSchema = z.object({
  subjectType: SubjectTypeSchema,
  subjectId: z.uuid(),
  message: text(2000).min(5),
});

// ── Public (published) content ──────────────────────────────────────────────
export interface PublicDifference {
  kind: 'authentication' | 'interpretation' | 'timing';
  summaryAr: string;
  summaryEn: string;
}
export interface PublicHadith {
  id: string;
  textAr: string;
  isExcerpt: boolean;
  translationEn: string | null;
  translationBy: string | null;
  narrator: { nameAr: string; nameEn: string } | null;
  source: { key: string; nameAr: string; nameEn: string; numberingScheme: string };
  number: string;
  url: string;
  grade: Grade;
  gradedBy: string;
  workCited: string;
  otherGradings: { grade: Grade; scholar: string; workCited: string }[];
  relevance: string | null;
  differences: PublicDifference[];
}
export interface PublicSunnah {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  instructionsAr: string | null;
  instructionsEn: string | null;
  classification: 'established' | 'less_commonly_practiced';
  trigger: z.infer<typeof SunnahTriggerSchema>;
  hadiths: PublicHadith[];
  differences: PublicDifference[];
}
export interface PublicOccasion {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  explanationAr: string;
  explanationEn: string;
  window: z.infer<typeof OccasionWindowSchema>;
  evidenceType: 'explicit_text' | 'scholarly_interpretation';
  schedulable: boolean;
  hadiths: PublicHadith[];
  differences: PublicDifference[];
}
