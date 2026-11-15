import { describe, expect, it } from 'vitest';
import {
  availableActions,
  checkTransition,
  hadithGate,
  hadithProblems,
  itemGate,
  itemProblems,
  type TransitionInput,
} from './workflow.js';

const base: TransitionInput = {
  action: 'submit',
  status: 'draft',
  actorId: 'a',
  actorRoles: ['editor', 'reviewer', 'publisher'],
  authorId: 'a',
  twoPersonRule: true,
};

describe('content workflow', () => {
  it('walks draft → awaiting → verified → approved with the right roles', () => {
    expect(checkTransition(base)).toMatchObject({ ok: true, to: 'awaiting_verification' });
    expect(
      checkTransition({ ...base, action: 'verify', status: 'awaiting_verification', actorId: 'b' }),
    ).toMatchObject({
      ok: true,
      to: 'verified',
      singleReviewer: false,
    });
    expect(checkTransition({ ...base, action: 'approve', status: 'verified' })).toMatchObject({
      ok: true,
      to: 'approved',
    });
  });

  it('refuses transitions from the wrong status', () => {
    expect(checkTransition({ ...base, action: 'approve', status: 'draft' })).toEqual({
      ok: false,
      error: 'content.transition_not_allowed',
    });
    expect(checkTransition({ ...base, action: 'submit', status: 'approved' }).ok).toBe(false);
  });

  it('requires the role for each step', () => {
    expect(checkTransition({ ...base, actorRoles: ['reviewer'] })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(
      checkTransition({
        ...base,
        action: 'approve',
        status: 'verified',
        actorRoles: ['editor', 'reviewer'],
      }),
    ).toEqual({
      ok: false,
      error: 'forbidden',
    });
    // admin alone grants nothing editorial
    expect(checkTransition({ ...base, actorRoles: ['admin'] })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('two-person rule: the author cannot verify their own item', () => {
    expect(checkTransition({ ...base, action: 'verify', status: 'awaiting_verification' })).toEqual(
      {
        ok: false,
        error: 'content.reviewer_is_author',
      },
    );
  });

  it('with the rule off, self-verification is allowed and flagged', () => {
    expect(
      checkTransition({
        ...base,
        action: 'verify',
        status: 'awaiting_verification',
        twoPersonRule: false,
      }),
    ).toMatchObject({ ok: true, singleReviewer: true });
  });

  it('blocks incomplete submissions and unpublishable approvals', () => {
    expect(checkTransition({ ...base, incomplete: ['text_ar'] })).toEqual({
      ok: false,
      error: 'content.incomplete',
      details: ['text_ar'],
    });
    expect(
      checkTransition({
        ...base,
        action: 'approve',
        status: 'verified',
        gateError: 'content.grade_not_publishable',
      }),
    ).toEqual({ ok: false, error: 'content.grade_not_publishable' });
  });

  it('lists the actions a person can take', () => {
    expect(availableActions('awaiting_verification', ['reviewer'])).toEqual(['verify', 'reject']);
    expect(availableActions('approved', ['editor'])).toEqual([]);
    expect(availableActions('approved', ['publisher'])).toEqual(['archive']);
  });
});

describe('completeness and the publication gate', () => {
  const ok = {
    textAr: 'نص',
    sourceUrl: 'https://sunnah.com/x',
    narratorId: 'n',
    authentications: [{ grade: 'sahih' as const, isPrimary: true }],
  };

  it('a hadith needs text, link, narrator and exactly one primary grading', () => {
    expect(hadithProblems(ok)).toEqual([]);
    expect(
      hadithProblems({ textAr: ' ', sourceUrl: null, narratorId: null, authentications: [] }),
    ).toEqual(['text_ar', 'source_url', 'narrator', 'authentication']);
    expect(
      hadithProblems({ ...ok, authentications: [{ grade: 'sahih', isPrimary: false }] }),
    ).toEqual(['primary_authentication']);
  });

  it('only sahih/hasan primary gradings are publishable; daif and mawdu never', () => {
    expect(hadithGate(ok)).toBeNull();
    expect(
      hadithGate({ ...ok, authentications: [{ grade: 'hasan_li_ghayrihi', isPrimary: true }] }),
    ).toBeNull();
    expect(hadithGate({ ...ok, authentications: [{ grade: 'daif', isPrimary: true }] })).toBe(
      'content.grade_not_publishable',
    );
    expect(
      hadithGate({
        ...ok,
        authentications: [
          { grade: 'mawdu', isPrimary: true },
          { grade: 'sahih', isPrimary: false },
        ],
      }),
    ).toBe('content.grade_not_publishable');
  });

  it('a Sunnah needs evidence, and every linked hadith must be approved first', () => {
    const item = {
      titleAr: 'عنوان',
      titleEn: 'Title',
      body: 'text',
      linked: ['approved' as const],
    };
    expect(itemProblems(item)).toEqual([]);
    expect(itemProblems({ ...item, linked: [] })).toEqual(['evidence']);
    expect(itemGate(item)).toBeNull();
    expect(itemGate({ ...item, linked: ['approved', 'verified'] })).toBe(
      'content.evidence_not_published',
    );
    expect(itemGate({ ...item, linked: [] })).toBe('content.evidence_not_published');
  });
});
