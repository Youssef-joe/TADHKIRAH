import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  DeleteAccountSchema,
  ExportFormatSchema,
  type DeleteAccountRequest,
  type ExportFormat,
} from '@tadhkirah/contracts';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard.js';
import { sessionCookieName, sessionCookieOptions } from '../auth/session-cookie.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { ExportService } from './export.service.js';
import { toMarkdown } from './markdown.js';
import { PrivacyService } from './privacy.service.js';

/** Data export (ACC-5) and account deletion (ACC-6). */
@Controller('me')
@UseGuards(SessionGuard)
export class PrivacyController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly exporter: ExportService,
    private readonly privacy: PrivacyService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Downloads everything we hold about the user, decrypted. Never cached. */
  @Get('export')
  async export(
    @CurrentAuth() auth: AuthContext,
    @Query('format', new ZodPipe(ExportFormatSchema)) format: ExportFormat,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    await this.rateLimit.hit(`export:user:${auth.userId}`, 10, 3600);
    const data = await this.exporter.collect(auth.userId);
    const day = data.exportedAt.slice(0, 10);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="tadhkirah-${day}.${format}"`);
    if (format === 'md') {
      const locale = data.profile?.locale === 'en' ? 'en' : 'ar';
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return toMarkdown(data, locale);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return JSON.stringify(data, null, 2);
  }

  @Post('delete')
  @HttpCode(204)
  async delete(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(DeleteAccountSchema)) body: DeleteAccountRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.rateLimit.hit(`delete:user:${auth.userId}`, 5, 3600);
    await this.privacy.deleteAccount(auth.userId, body.confirmEmail);
    const { maxAge: _, ...opts } = sessionCookieOptions(this.env);
    res.clearCookie(sessionCookieName(this.env), opts);
  }
}
