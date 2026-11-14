import { z } from 'zod';

/** `YYYY-MM-DD`, a tracking day (see ADR-001). */
export const LocalDateSchema = z.iso.date();

export const LocaleSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  checks: z.record(z.string(), z.enum(['ok', 'fail'])).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** RFC 9457 problem details returned by every API error. */
export const ProblemSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Field-level validation messages, keyed by dotted path. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const API_VERSION = 'v1' as const;
