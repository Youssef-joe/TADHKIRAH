import { CSRF_HEADER, type Problem } from '@tadhkirah/contracts';

/** An API failure with the stable machine-readable `code` from problem+json. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problem?: Problem,
  ) {
    super(code);
  }
}

/**
 * Browser-side API client. It always calls the same origin (`/v1/*`), which the
 * Next.js server forwards to the API container, so the httpOnly session cookie
 * travels automatically. Every request carries the CSRF header.
 */
export async function api<T = void>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/v1${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        [CSRF_HEADER]: '1',
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.status === 204 || res.status === 202) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const problem = data as Problem | null;
    throw new ApiError(res.status, problem?.code ?? 'internal', problem ?? undefined);
  }
  return data as T;
}

/** Maps API error codes to message keys in the `errors` namespace. */
export function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return 'generic';
  switch (err.code) {
    case 'network':
      return 'network';
    case 'auth.invalid_code':
      return 'invalidCode';
    case 'auth.rate_limited':
      return 'rateLimited';
    case 'auth.email_unavailable':
      return 'emailUnavailable';
    case 'validation.failed':
      return err.problem?.errors?.email ? 'invalidEmail' : 'generic';
    default:
      return 'generic';
  }
}
