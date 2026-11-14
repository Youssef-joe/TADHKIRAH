import { z } from 'zod';
import { LocalDateSchema } from './common.js';

export const AnswerTypeSchema = z.enum(['yes_partly_no', 'text', 'both']);
export const ChoiceSchema = z.enum(['yes', 'partly', 'no', 'prefer_not']);

const PrivateText = (max: number) => z.string().trim().max(max);

export const ReflectionQuestionSchema = z.object({
  id: z.uuid(),
  catalogKey: z.string().nullable(),
  /** Custom questions only (decrypted for the owner). Built-in text comes from i18n. */
  text: z.string().nullable(),
  answerType: AnswerTypeSchema,
  enabled: z.boolean(),
  sort: z.number().int(),
});
export type ReflectionQuestionDto = z.infer<typeof ReflectionQuestionSchema>;

export const CreateQuestionSchema = z.object({
  text: PrivateText(200).min(1),
  answerType: AnswerTypeSchema.default('yes_partly_no'),
});
export const UpdateQuestionSchema = z
  .object({ text: PrivateText(200).min(1), answerType: AnswerTypeSchema, enabled: z.boolean() })
  .partial()
  .strict();
export type UpdateQuestion = z.infer<typeof UpdateQuestionSchema>;
export const ReorderQuestionsSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });

export const AnswerSchema = z.object({
  questionId: z.uuid(),
  choice: ChoiceSchema.nullable().default(null),
  text: PrivateText(2000).nullable().default(null),
});
export type AnswerDto = z.infer<typeof AnswerSchema>;

export const ReflectionSchema = z.object({
  localDate: LocalDateSchema,
  version: z.number().int(),
  answers: z.array(AnswerSchema),
  gratitude: z.array(z.string()),
  shortcoming: z.string().nullable(),
  repentanceNoted: z.boolean(),
  intention: z.string().nullable(),
  freeText: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
});
export type ReflectionDto = z.infer<typeof ReflectionSchema>;

/** Full-document save. Send `version` (from GET) to detect edits from another device. */
export const SaveReflectionSchema = z.object({
  version: z.number().int().min(0).optional(),
  answers: z.array(AnswerSchema).max(100).default([]),
  gratitude: z.array(PrivateText(300)).max(3).default([]),
  shortcoming: PrivateText(2000).nullable().default(null),
  repentanceNoted: z.boolean().default(false),
  intention: PrivateText(300).nullable().default(null),
  freeText: PrivateText(5000).nullable().default(null),
  complete: z.boolean().default(false),
});
export type SaveReflection = z.input<typeof SaveReflectionSchema>;

export const ReflectionDayResponseSchema = z.object({
  today: LocalDateSchema,
  backfillDays: z.number().int(),
  questions: z.array(ReflectionQuestionSchema),
  reflection: ReflectionSchema.nullable(),
  /** Suggested choices from the day's worship log, keyed by question id (REF-9). */
  suggestions: z.record(z.string(), ChoiceSchema),
});
export type ReflectionDayResponse = z.infer<typeof ReflectionDayResponseSchema>;

export const ReflectionMetaSchema = z.object({
  localDate: LocalDateSchema,
  completedAt: z.iso.datetime().nullable(),
  answeredCount: z.number().int(),
});
