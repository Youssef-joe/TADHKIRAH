import { describe, expect, it } from 'vitest';
import { checkTransition, availableActions } from './workflow.js';
import { DAY_MS, digestDue, nextReviewDue, reviewState } from './review-cycle.js';

const now = new Date('2026-11-15T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * DAY_MS);

describe('re-review cycle', () => {
  it('schedules the next review a fixed interval after verification', () => {
    expect(nextReviewDue(now, 365).toISOString()).toBe('2027-11-15T12:00:00.000Z');
  });

  it('classifies items as scheduled, due soon, due and overdue', () => {
    expect(reviewState(days(40), now)).toBe('scheduled');
    expect(reviewState(days(10), now)).toBe('due_soon');
    expect(reviewState(days(-1), now)).toBe('due');
    expect(reviewState(days(-31), now)).toBe('overdue');
    // Never scheduled (published before the cycle existed): due now.
    expect(reviewState(null, now)).toBe('due');
  });

  it('lets a reviewer reconfirm a published item, keeping it published', () => {
    expect(availableActions('approved', ['reviewer'])).toEqual(['reconfirm']);
    expect(availableActions('approved', ['publisher'])).toEqual(['archive']);
    const r = checkTransition({
      action: 'reconfirm',
      status: 'approved',
      actorId: 'r',
      actorRoles: ['reviewer'],
      authorId: 'a',
      twoPersonRule: true,
    });
    expect(r).toEqual({ ok: true, to: 'approved', actorRole: 'reviewer', singleReviewer: false });
  });

  it('applies the two-person rule and the publication gate to reconfirmation', () => {
    const base = {
      action: 'reconfirm' as const,
      status: 'approved' as const,
      actorId: 'a',
      actorRoles: ['reviewer' as const],
      authorId: 'a',
    };
    expect(checkTransition({ ...base, twoPersonRule: true })).toMatchObject({
      ok: false,
      error: 'content.reviewer_is_author',
    });
    expect(checkTransition({ ...base, twoPersonRule: false })).toMatchObject({
      ok: true,
      singleReviewer: true,
    });
    expect(
      checkTransition({
        ...base,
        authorId: 'b',
        twoPersonRule: true,
        gateError: 'content.grade_not_publishable',
      }),
    ).toMatchObject({ ok: false, error: 'content.grade_not_publishable' });
    expect(checkTransition({ ...base, status: 'verified', twoPersonRule: false })).toMatchObject({
      ok: false,
      error: 'content.transition_not_allowed',
    });
  });

  it('sends digests only when there is work, at most daily, sooner for new reports', () => {
    const quiet = { now, dueCount: 0, openReports: 0, newestReportAt: null };
    expect(digestDue({ ...quiet, lastSentAt: null })).toBe(false);
    const work = { now, dueCount: 3, openReports: 0, newestReportAt: null };
    expect(digestDue({ ...work, lastSentAt: null })).toBe(true);
    expect(digestDue({ ...work, lastSentAt: days(-3) })).toBe(false);
    expect(digestDue({ ...work, lastSentAt: days(-7) })).toBe(true);
    const report = { now, dueCount: 0, openReports: 1, newestReportAt: days(-1) };
    expect(digestDue({ ...report, lastSentAt: days(-2) })).toBe(true);
    expect(digestDue({ ...report, lastSentAt: new Date(now.getTime() - DAY_MS / 2) })).toBe(false);
  });
});
