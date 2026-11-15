/**
 * Editorial workflow for Islamic content (CON-3, CON-4; PRD J5, ADR-003).
 * Pure rules, shared by the API and the admin UI.
 *
 * draft → awaiting_verification → verified → approved
 *   reject: from awaiting_verification or verified → rejected → (reopen) → draft
 *   archive: from draft, rejected or approved
 *   reconfirm: approved → approved (periodic re-review; the item stays published)
 */
export const CONTENT_STATUSES = [
  'draft',
  'awaiting_verification',
  'verified',
  'approved',
  'rejected',
  'archived',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const EDITORIAL_ROLES = ['admin', 'editor', 'reviewer', 'publisher'] as const;
export type EditorialRole = (typeof EDITORIAL_ROLES)[number];

export const CONTENT_ACTIONS = [
  'submit',
  'verify',
  'reject',
  'approve',
  'archive',
  'reopen',
  'reconfirm',
] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

export const GRADES = [
  'sahih',
  'hasan',
  'sahih_li_ghayrihi',
  'hasan_li_ghayrihi',
  'daif',
  'mawdu',
] as const;
export type Grade = (typeof GRADES)[number];
/** Only these primary grades can ever be published (CON-2, policy §7.1). */
export const PUBLISHABLE_GRADES: readonly Grade[] = [
  'sahih',
  'hasan',
  'sahih_li_ghayrihi',
  'hasan_li_ghayrihi',
];

const TRANSITIONS: Record<
  ContentAction,
  { from: readonly ContentStatus[]; to: ContentStatus; role: EditorialRole }
> = {
  submit: { from: ['draft'], to: 'awaiting_verification', role: 'editor' },
  verify: { from: ['awaiting_verification'], to: 'verified', role: 'reviewer' },
  reject: { from: ['awaiting_verification', 'verified'], to: 'rejected', role: 'reviewer' },
  approve: { from: ['verified'], to: 'approved', role: 'publisher' },
  archive: { from: ['draft', 'rejected', 'approved'], to: 'archived', role: 'publisher' },
  reopen: { from: ['rejected'], to: 'draft', role: 'editor' },
  reconfirm: { from: ['approved'], to: 'approved', role: 'reviewer' },
};

/** Only drafts are edited; an approved item changes through a new revision. */
export const isEditable = (status: ContentStatus) => status === 'draft';

export type TransitionError =
  | 'content.transition_not_allowed'
  | 'forbidden'
  | 'content.reviewer_is_author'
  | 'content.incomplete'
  | 'content.grade_not_publishable'
  | 'content.evidence_not_published';

export interface TransitionInput {
  action: ContentAction;
  status: ContentStatus;
  actorId: string;
  actorRoles: readonly EditorialRole[];
  authorId: string | null;
  /** ADR-003: on by default; a team of one can turn it off (every such approval is flagged). */
  twoPersonRule: boolean;
  /** What's missing for `submit` (see the *Problems helpers). */
  incomplete?: string[];
  /** For `approve`. */
  gateError?: 'content.grade_not_publishable' | 'content.evidence_not_published' | null;
}

export type TransitionResult =
  | { ok: true; to: ContentStatus; actorRole: EditorialRole; singleReviewer: boolean }
  | { ok: false; error: TransitionError; details?: string[] };

export function checkTransition(i: TransitionInput): TransitionResult {
  const t = TRANSITIONS[i.action];
  if (!t.from.includes(i.status)) return { ok: false, error: 'content.transition_not_allowed' };
  if (!i.actorRoles.includes(t.role)) return { ok: false, error: 'forbidden' };

  let singleReviewer = false;
  // A re-review is a fresh verification, so the two-person rule applies to it too.
  const verifying = i.action === 'verify' || i.action === 'reconfirm';
  if (verifying && i.authorId !== null && i.authorId === i.actorId) {
    if (i.twoPersonRule) return { ok: false, error: 'content.reviewer_is_author' };
    singleReviewer = true;
  }
  if (i.action === 'submit' && i.incomplete?.length) {
    return { ok: false, error: 'content.incomplete', details: i.incomplete };
  }
  // Reconfirming re-checks the publication gate: a grading changed since approval blocks it.
  if ((i.action === 'approve' || i.action === 'reconfirm') && i.gateError)
    return { ok: false, error: i.gateError };
  return { ok: true, to: t.to, actorRole: t.role, singleReviewer };
}

/** Which actions the actor could take now (for the admin UI's buttons). */
export function availableActions(
  status: ContentStatus,
  roles: readonly EditorialRole[],
): ContentAction[] {
  return CONTENT_ACTIONS.filter(
    (a) => TRANSITIONS[a].from.includes(status) && roles.includes(TRANSITIONS[a].role),
  );
}

export interface HadithForReview {
  textAr: string | null;
  sourceUrl: string | null;
  narratorId: string | null;
  authentications: { grade: Grade; isPrimary: boolean }[];
}

/** What a hadith still needs before it can be submitted for verification. */
export function hadithProblems(h: HadithForReview): string[] {
  const p: string[] = [];
  if (!h.textAr?.trim()) p.push('text_ar');
  if (!h.sourceUrl?.trim()) p.push('source_url');
  if (!h.narratorId) p.push('narrator');
  if (!h.authentications.length) p.push('authentication');
  else if (h.authentications.filter((a) => a.isPrimary).length !== 1)
    p.push('primary_authentication');
  return p;
}

export function hadithGate(h: HadithForReview): 'content.grade_not_publishable' | null {
  const primary = h.authentications.find((a) => a.isPrimary);
  return primary && PUBLISHABLE_GRADES.includes(primary.grade)
    ? null
    : 'content.grade_not_publishable';
}

export interface ItemForReview {
  titleAr: string;
  titleEn: string;
  body: string;
  /** Status of each linked hadith. */
  linked: ContentStatus[];
}

/** Sunnahs and occasions: complete, with at least one linked hadith. */
export function itemProblems(i: ItemForReview): string[] {
  const p: string[] = [];
  if (!i.titleAr.trim() || !i.titleEn.trim()) p.push('title');
  if (!i.body.trim()) p.push('description');
  if (!i.linked.length) p.push('evidence');
  return p;
}

/** Publication gate for items (CON-9): every linked hadith must already be approved. */
export function itemGate(i: ItemForReview): 'content.evidence_not_published' | null {
  return i.linked.length && i.linked.every((s) => s === 'approved')
    ? null
    : 'content.evidence_not_published';
}
