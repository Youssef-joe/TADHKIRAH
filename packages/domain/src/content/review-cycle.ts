/**
 * Periodic re-review of published content (the "verification loop"). Every
 * approved item has a date by which a reviewer looks at it again; a user's
 * problem report brings that date forward to now. The item stays published
 * while it waits: re-review is a check, not a takedown. Pulling an item is a
 * deliberate archive or revision.
 */
export const DAY_MS = 86_400_000;

/** When an item verified at `verifiedAt` is next due for re-review. */
export function nextReviewDue(verifiedAt: Date, intervalDays: number): Date {
  return new Date(verifiedAt.getTime() + intervalDays * DAY_MS);
}

export type ReviewState = 'scheduled' | 'due_soon' | 'due' | 'overdue';

/**
 * - due_soon: within `soonDays` of the date, so reviewers can plan ahead
 * - due: the date has passed
 * - overdue: more than `graceDays` past it (shown more prominently)
 */
export function reviewState(
  dueAt: Date | null,
  now: Date,
  { soonDays = 14, graceDays = 30 }: { soonDays?: number; graceDays?: number } = {},
): ReviewState {
  if (!dueAt) return 'due';
  const diff = dueAt.getTime() - now.getTime();
  if (diff > soonDays * DAY_MS) return 'scheduled';
  if (diff > 0) return 'due_soon';
  return -diff > graceDays * DAY_MS ? 'overdue' : 'due';
}

/**
 * Whether a reviewer gets a digest now: never more than once a day, weekly when
 * only scheduled reviews are waiting, and within a day when a new problem report
 * arrived since the last digest.
 */
export function digestDue(input: {
  now: Date;
  lastSentAt: Date | null;
  dueCount: number;
  openReports: number;
  newestReportAt: Date | null;
}): boolean {
  const { now, lastSentAt, dueCount, openReports, newestReportAt } = input;
  if (!dueCount && !openReports) return false;
  if (!lastSentAt) return true;
  const since = now.getTime() - lastSentAt.getTime();
  if (since < DAY_MS) return false;
  if (newestReportAt && newestReportAt > lastSentAt) return true;
  return since >= 7 * DAY_MS;
}
