import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AppError, readCookie, type AppRequest } from '../common/http.js';
import { sessionCookieName } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

/** Requires a valid session: the web cookie, or `Authorization: Bearer` for mobile. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const cookie = readCookie(req, sessionCookieName(this.env));
    const token = bearer || cookie;
    if (!token || token.length > 200) throw new AppError(401, 'auth.unauthenticated');

    const session = await this.sessions.resolve(token);
    if (!session) throw new AppError(401, 'auth.unauthenticated');

    req.auth = { ...session, via: bearer ? 'bearer' : 'cookie' };
    return true;
  }
}
