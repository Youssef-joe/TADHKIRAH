import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  EmailStartRequestSchema,
  EmailVerifyRequestSchema,
  type EmailStartRequest,
  type EmailVerifyRequest,
  type EmailVerifyResponse,
  type SessionInfo,
} from '@tadhkirah/contracts';
import type { Request, Response } from 'express';
import { AppError, CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AuthService } from './auth.service.js';
import { deviceLabelFromUserAgent } from './crypto.js';
import { sessionCookieName, sessionCookieOptions } from './session-cookie.js';
import { SessionGuard } from './session.guard.js';
import { SessionsService } from './sessions.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Always 202, so the response doesn't reveal whether the email has an account. */
  @Post('email/start')
  @HttpCode(202)
  async start(
    @Body(new ZodPipe(EmailStartRequestSchema)) body: EmailStartRequest,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.start(body.email, body.locale, req.ip ?? 'unknown');
  }

  @Post('email/verify')
  @HttpCode(200)
  async verify(
    @Body(new ZodPipe(EmailVerifyRequestSchema)) body: EmailVerifyRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmailVerifyResponse> {
    const user = await this.auth.verify(body, req.ip ?? 'unknown');
    const label = body.deviceLabel ?? deviceLabelFromUserAgent(req.headers['user-agent']);
    const kind = body.client === 'mobile' ? 'bearer' : 'cookie';
    const { token } = await this.sessions.create(user.userId, kind, label);

    const response: EmailVerifyResponse = {
      user: { id: user.userId, email: user.email },
      isNew: user.isNew,
      locale: user.locale,
    };
    if (kind === 'bearer') return { ...response, accessToken: token };
    res.cookie(sessionCookieName(this.env), token, sessionCookieOptions(this.env));
    return response;
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revoke(auth.userId, auth.sessionId);
    const { maxAge: _, ...opts } = sessionCookieOptions(this.env);
    res.clearCookie(sessionCookieName(this.env), opts);
  }

  @Get('sessions')
  @UseGuards(SessionGuard)
  list(@CurrentAuth() auth: AuthContext): Promise<SessionInfo[]> {
    return this.sessions.list(auth.userId, auth.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    if (!(await this.sessions.revoke(auth.userId, id))) throw new AppError(404, 'not_found');
  }
}
