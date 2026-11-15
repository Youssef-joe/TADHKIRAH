import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CSRF_HEADER } from '@tadhkirah/contracts';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { sessionCookieName } from '../auth/session-cookie.js';
import { AppError, readCookie, type AppRequest } from './http.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

const SKIP_CSRF = 'tadhkirah:skip-csrf';
/**
 * For endpoints a third party POSTs to with a top-level navigation (Sign in with
 * Apple's form_post callback). They must carry their own proof, such as a signed
 * state bound to a cookie, and must not act on the session cookie.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

/**
 * CSRF protection for cookie-authenticated requests (Architecture §6). It applies
 * to every route.
 *  1. Any state-changing request with an `Origin` header must come from an
 *     allowed web origin. This also blocks login CSRF.
 *  2. A state-changing request that carries the session cookie must also send
 *     the custom header `x-tadhkirah-csrf: 1`. Cross-site pages can't add custom
 *     headers without a CORS preflight, which we refuse.
 * Bearer-token clients (mobile) are unaffected.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (SAFE.has(req.method)) return true;
    if (this.reflector.get<boolean>(SKIP_CSRF, ctx.getHandler())) return true;

    const origin = req.headers.origin;
    if (origin && !this.env.WEB_ORIGINS.includes(origin)) {
      throw new AppError(403, 'csrf.origin_mismatch', 'Request origin not allowed');
    }

    const hasBearer = req.headers.authorization?.startsWith('Bearer ') ?? false;
    const hasCookie = readCookie(req, sessionCookieName(this.env)) !== undefined;
    if (hasCookie && !hasBearer && req.headers[CSRF_HEADER] !== '1') {
      throw new AppError(403, 'csrf.missing_header', 'Missing CSRF header');
    }
    return true;
  }
}
