import { createParamDecorator, HttpException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthContext {
  userId: string;
  sessionId: string;
  via: 'cookie' | 'bearer';
}

export type AppRequest = Request & { auth?: AuthContext };

/** The authenticated session. Use it only on routes behind `SessionGuard`. */
export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => {
    const auth = ctx.switchToHttp().getRequest<AppRequest>().auth;
    if (!auth) throw new Error('CurrentAuth used on a route without SessionGuard');
    return auth;
  },
);

/** Minimal Cookie header parser (we only read our own cookies). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** A domain error with a stable machine-readable `code` (rendered as problem+json). */
export class AppError extends HttpException {
  constructor(status: number, code: string, message?: string, extra: Record<string, unknown> = {}) {
    super({ code, message, ...extra }, status);
  }
}
