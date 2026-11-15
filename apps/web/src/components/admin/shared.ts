import { ApiError } from '@/lib/api';

export const TYPES = ['hadiths', 'sunnahs', 'occasions'] as const;
export type AdminType = (typeof TYPES)[number];
export const STATUSES = [
  'draft',
  'awaiting_verification',
  'verified',
  'approved',
  'rejected',
  'archived',
] as const;
export const GRADES = [
  'sahih',
  'hasan',
  'sahih_li_ghayrihi',
  'hasan_li_ghayrihi',
  'daif',
  'mawdu',
] as const;
export const TRIGGERS = [
  'daily',
  'on_waking',
  'before_sleep',
  'eating',
  'entering_mosque',
  'friday',
] as const;
export const WINDOWS = [
  'last_third_of_night',
  'jumuah_imam_to_prayer',
  'friday_last_hour_after_asr',
  'between_adhan_iqamah',
  'in_sujud',
  'anytime',
] as const;

/** Maps an API error to a key in the `admin` namespace (null → use errors.generic). */
export function adminErrorKey(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const map: Record<string, string> = {
    'content.reviewer_is_author': 'err_reviewer_is_author',
    'content.transition_not_allowed': 'err_transition',
    forbidden: 'err_forbidden',
    'content.incomplete': 'err_incomplete',
    'content.grade_not_publishable': 'gateGrade',
    'content.evidence_not_published': 'gateEvidence',
    'content.session_too_old': 'err_session',
    'content.duplicate': 'err_duplicate',
    'content.not_editable': 'err_not_editable',
    'content.user_not_found': 'err_user_not_found',
  };
  return map[err.code] ?? null;
}

export const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-border/60 text-text',
  awaiting_verification: 'bg-accent/15 text-accent',
  verified: 'bg-primary/10 text-primary',
  approved: 'bg-primary text-white',
  rejected: 'bg-danger/10 text-danger',
  archived: 'bg-border/40 text-muted',
};
