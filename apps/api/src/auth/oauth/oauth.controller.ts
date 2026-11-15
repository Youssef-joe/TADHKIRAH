import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  API_VERSION,
  OAuthStartQuerySchema,
  type LinkedIdentity,
  type Locale,
  type OAuthProvidersResponse,
} from '@tadhkirah/contracts';
import type { CookieOptions, Request, Response } from 'express';
import type { z } from 'zod';
import { SkipCsrf } from '../../common/csrf.guard.js';
import { AppError, CurrentAuth, readCookie, type AuthContext } from '../../common/http.js';
import { RateLimitService } from '../../common/rate-limit.service.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { ENV } from '../../config/config.module.js';
import { isSecureDeployment, type Env } from '../../config/env.js';
import { deviceLabelFromUserAgent } from '../crypto.js';
import { sessionCookieName, sessionCookieOptions } from '../session-cookie.js';
import { SessionGuard } from '../session.guard.js';
import { SessionsService } from '../sessions.service.js';
import { FLOW_TTL_MS, OAuthError, OAuthService } from './oauth.service.js';

/**
 * Google / Apple sign-in (ACC-2). These are browser navigations, not fetches:
 * "start" redirects to the provider, and the provider redirects (Google, GET) or
 * posts (Apple, form_post) back to "callback", which sets the session cookie and
 * redirects into the app.
 */
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly sessions: SessionsService,
    private readonly rateLimit: RateLimitService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('providers')
  providers(): OAuthProvidersResponse {
    return { providers: this.oauth.enabled() };
  }

  @Get('identities')
  @UseGuards(SessionGuard)
  identities(@CurrentAuth() auth: AuthContext): Promise<LinkedIdentity[]> {
    return this.oauth.list(auth.userId);
  }

  @Delete('identities/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async unlink(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    if (!(await this.oauth.unlink(auth.userId, id))) throw new AppError(404, 'not_found');
  }

  @Get('oauth/:provider/start')
  async start(
    @Param('provider') provider: string,
    @Query(new ZodPipe(OAuthStartQuerySchema)) q: z.output<typeof OAuthStartQuerySchema>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.oauth.has(provider)) throw new AppError(404, 'not_found');
    await this.rateLimit.hit(`oauth:ip:${req.ip ?? 'unknown'}`, 30, 3600);
    try {
      const { url, cookie } = await this.oauth.start(provider, q.locale, q.tz);
      res.cookie(this.cookieName(), cookie, this.cookieOptions(FLOW_TTL_MS));
      res.redirect(303, url);
    } catch (err) {
      this.oauth.logFailure(provider, err);
      res.redirect(303, this.failureUrl(q.locale, 'failed'));
    }
  }

  @Get('oauth/:provider/callback')
  callbackGet(
    @Param('provider') provider: string,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.finish(provider, query, req, res);
  }

  /** Apple's form_post: a cross-site POST, so no CSRF header. The signed state proves the flow. */
  @Post('oauth/:provider/callback')
  @SkipCsrf()
  callbackPost(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.finish(provider, (req.body ?? {}) as Record<string, unknown>, req, res);
  }

  private async finish(
    provider: string,
    input: Record<string, unknown>,
    req: Request,
    res: Response,
  ): Promise<void> {
    const cookie = readCookie(req, this.cookieName());
    const locale = this.oauth.flowLocale(cookie);
    res.clearCookie(this.cookieName(), this.cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    if (!this.oauth.has(provider)) throw new AppError(404, 'not_found');
    try {
      const user = await this.oauth.callback(provider, input, cookie);
      const label = deviceLabelFromUserAgent(req.headers['user-agent']);
      const { token } = await this.sessions.create(user.userId, 'cookie', label);
      res.cookie(sessionCookieName(this.env), token, sessionCookieOptions(this.env));
      // The verify page clears data cached for any previous account, then opens the app.
      res.redirect(303, `${this.env.PUBLIC_WEB_URL}/${user.locale}/verify#signed-in`);
    } catch (err) {
      this.oauth.logFailure(provider, err);
      res.redirect(303, this.failureUrl(locale, err instanceof OAuthError ? err.reason : 'failed'));
    }
  }

  private failureUrl(locale: Locale, reason: string): string {
    return `${this.env.PUBLIC_WEB_URL}/${locale}/sign-in?oauth=${reason}`;
  }

  private cookieName(): string {
    return isSecureDeployment(this.env) ? '__Secure-tadhkirah_oauth' : 'tadhkirah_oauth';
  }

  /** SameSite=None over HTTPS so Apple's cross-site form_post brings it back. */
  private cookieOptions(maxAge?: number): CookieOptions {
    const secure = isSecureDeployment(this.env);
    return {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: `/${API_VERSION}/auth/oauth`,
      ...(maxAge ? { maxAge } : {}),
    };
  }
}
