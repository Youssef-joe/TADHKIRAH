import { z } from 'zod';
import { LocalDateSchema } from './common.js';

const SurahN = z.number().int().min(1).max(114);
const AyahN = z.number().int().min(1).max(286);
const Ref = z.object({ surah: SurahN, ayah: AyahN });

export const RecitationSchema = z.object({
  id: z.uuid(),
  localDate: LocalDateSchema,
  pages: z.number().nullable(),
  from: Ref.nullable(),
  to: Ref.nullable(),
});
export type RecitationDto = z.infer<typeof RecitationSchema>;

/** Pages, a range, or both. The API checks the range against real ayah counts. */
export const CreateRecitationSchema = z
  .object({
    id: z.uuid(),
    localDate: LocalDateSchema,
    pages: z.number().positive().max(604).nullable().default(null),
    from: Ref.nullable().default(null),
    to: Ref.nullable().default(null),
  })
  .refine((v) => v.pages !== null || (v.from && v.to), 'Provide pages or a range')
  .refine((v) => (v.from === null) === (v.to === null), 'A range needs both ends');
export type CreateRecitation = z.input<typeof CreateRecitationSchema>;

export const MemorizationStatusSchema = z.enum(['not_started', 'in_progress', 'memorized']);
const Range = z.tuple([AyahN, AyahN]);

export const MemorizationSchema = z.object({
  surah: SurahN,
  status: MemorizationStatusSchema,
  ranges: z.array(Range),
  lastRevisedOn: LocalDateSchema.nullable(),
});
export type MemorizationDto = z.infer<typeof MemorizationSchema>;

export const UpdateMemorizationSchema = z.object({
  status: MemorizationStatusSchema,
  ranges: z.array(Range).max(100).default([]),
});
export type UpdateMemorization = z.input<typeof UpdateMemorizationSchema>;

export const RevisionQualitySchema = z.enum(['smooth', 'some_mistakes', 'needs_work']);

export const RevisionSchema = z.object({
  id: z.uuid(),
  localDate: LocalDateSchema,
  surah: SurahN,
  fromAyah: AyahN,
  toAyah: AyahN,
  quality: RevisionQualitySchema.nullable(),
});
export type RevisionDto = z.infer<typeof RevisionSchema>;

export const CreateRevisionSchema = RevisionSchema.extend({
  quality: RevisionQualitySchema.nullable().default(null),
});
export type CreateRevision = z.input<typeof CreateRevisionSchema>;

export const QuranSummarySchema = z.object({
  today: LocalDateSchema,
  backfillDays: z.number().int(),
  totalAyahs: z.number().int(),
  memorizedAyahs: z.number().int(),
  memorizedSurahs: z.number().int(),
  inProgressSurahs: z.number().int(),
  memorization: z.array(MemorizationSchema),
  revisionDue: z.array(z.object({ surah: SurahN, lastRevisedOn: LocalDateSchema.nullable() })),
  /** Last 7 tracking days, newest first. */
  recentRecitations: z.array(RecitationSchema),
  recentRevisions: z.array(RevisionSchema),
});
export type QuranSummary = z.infer<typeof QuranSummarySchema>;
