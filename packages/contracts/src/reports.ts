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

/** What weekly and monthly reports share (REP-7: "same structure"). */
const PeriodFields = {
  today: LocalDateSchema,
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
};

export const WeeklyReportSchema = z.object({
  weekStart: LocalDateSchema,
  weekEnd: LocalDateSchema,
  isCurrentWeek: z.boolean(),
  ...PeriodFields,
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

export const ReportCalendarSchema = z.enum(['gregorian', 'hijri']);
/** `YYYY-MM` in the report's own calendar: `1448-09` is Ramadan 1448. */
export const MonthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const MonthlyReportSchema = z.object({
  calendar: ReportCalendarSchema,
  month: MonthKeySchema,
  start: LocalDateSchema,
  end: LocalDateSchema,
  isCurrentMonth: z.boolean(),
  ...PeriodFields,
  /** Weekly reviews saved for weeks starting in this month (a count; the text stays private). */
  reviewsSaved: z.number().int(),
});
export type MonthlyReport = z.infer<typeof MonthlyReportSchema>;

export const MonthlyReportQuerySchema = z.object({
  month: MonthKeySchema.optional(),
  calendar: ReportCalendarSchema.default('gregorian'),
});
