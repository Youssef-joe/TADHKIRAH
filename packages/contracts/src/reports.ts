import { z } from 'zod';
import { LocalDateSchema } from './common.js';

export const DayStateSchema = z.enum([
  'logged',
  'partial',
  'not_logged',
  'excused',
  'not_scheduled',
  'future',
]);

export const ActivityReportSchema = z.object({
  activityId: z.uuid(),
  catalogKey: z.string().nullable(),
  name: z.string().nullable(),
  category: z.string(),
  obligation: z.enum(['obligatory', 'voluntary']),
  /** Counts only: no percentages and no scores (PRD REP-8). */
  eligible: z.number().int(),
  logged: z.number().int(),
  excused: z.number().int(),
  perDay: z.array(DayStateSchema),
  /** Obligatory prayers: how many days each status was logged. */
  statusBreakdown: z
    .object({ on_time: z.number().int(), later: z.number().int(), qada: z.number().int() })
    .nullable(),
  needsAttention: z.boolean(),
});
export type ActivityReport = z.infer<typeof ActivityReportSchema>;

export const GoalSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  source: z.enum(['weekly_review', 'daily_intention', 'manual']),
  status: z.enum(['active', 'done', 'let_go']),
  startsOn: LocalDateSchema,
  endsOn: LocalDateSchema.nullable(),
});
export type GoalDto = z.infer<typeof GoalSchema>;

export const WeeklyReportSchema = z.object({
  weekStart: LocalDateSchema,
  weekEnd: LocalDateSchema,
  today: LocalDateSchema,
  isCurrentWeek: z.boolean(),
  days: z.array(LocalDateSchema),
  excusedDays: z.number().int(),
  activities: z.array(ActivityReportSchema),
  quran: z.object({
    pages: z.number(),
    recitationDays: z.number().int(),
    revisedAyahs: z.number().int(),
    revisions: z.number().int(),
    memorizedAyahs: z.number().int(),
  }),
  reflections: z.object({
    written: z.number().int(),
    completed: z.number().int(),
    perDay: z.array(z.boolean()),
  }),
  goals: z.array(GoalSchema),
  reviewSaved: z.boolean(),
});
export type WeeklyReport = z.infer<typeof WeeklyReportSchema>;

export const WeeklyReviewSchema = z.object({
  weekStart: LocalDateSchema,
  improved: z.string().nullable(),
  neglected: z.string().nullable(),
  madeEasier: z.string().nullable(),
  changeNext: z.string().nullable(),
});
export type WeeklyReviewDto = z.infer<typeof WeeklyReviewSchema>;

const PrivateText = z.string().trim().max(2000).nullable().default(null);
export const SaveWeeklyReviewSchema = z.object({
  improved: PrivateText,
  neglected: PrivateText,
  madeEasier: PrivateText,
  changeNext: PrivateText,
  /** Also create next week's goal from "what should change". */
  makeGoal: z.boolean().default(false),
});
export type SaveWeeklyReview = z.input<typeof SaveWeeklyReviewSchema>;

export const CreateGoalSchema = z.object({
  text: z.string().trim().min(1).max(300),
  startsOn: LocalDateSchema.optional(),
  endsOn: LocalDateSchema.nullable().default(null),
});
export const UpdateGoalSchema = z
  .object({ status: z.enum(['active', 'done', 'let_go']), text: z.string().trim().min(1).max(300) })
  .partial()
  .strict();
export type UpdateGoal = z.infer<typeof UpdateGoalSchema>;

export const WeeklyReportQuerySchema = z.object({ weekStart: LocalDateSchema.optional() });
