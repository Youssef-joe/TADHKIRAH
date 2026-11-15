import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  IssueReportInputSchema,
  type PublicOccasion,
  type PublicSunnah,
} from '@tadhkirah/contracts';
import { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PublicContentService } from './public.service.js';

const Slug = new ZodPipe(z.string().regex(/^[a-z0-9-]{1,80}$/));
const CACHE = 'public, max-age=300, stale-while-revalidate=3600';

/** Published, verified content only (CON-9). No session needed; cacheable. */
@Controller('content')
export class ContentController {
  constructor(
    private readonly content: PublicContentService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('sunnahs')
  @Header('Cache-Control', CACHE)
  sunnahs(): Promise<PublicSunnah[]> {
    return this.content.sunnahs();
  }
  @Get('sunnahs/:slug')
  @Header('Cache-Control', CACHE)
  async sunnah(@Param('slug', Slug) slug: string): Promise<PublicSunnah> {
    return (await this.content.sunnahs(slug))[0]!;
  }
  @Get('supplication-occasions')
  @Header('Cache-Control', CACHE)
  occasions(): Promise<PublicOccasion[]> {
    return this.content.occasions();
  }
  @Get('supplication-occasions/:slug')
  @Header('Cache-Control', CACHE)
  async occasion(@Param('slug', Slug) slug: string): Promise<PublicOccasion> {
    return (await this.content.occasions(slug))[0]!;
  }

  /** "Report a problem with this source": signed-in users, a few per hour. */
  @Post('issue-reports')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async report(
    @CurrentAuth() a: AuthContext,
    @Body(new ZodPipe(IssueReportInputSchema)) body: z.output<typeof IssueReportInputSchema>,
  ) {
    await this.rateLimit.hit(`content-report:user:${a.userId}`, 5, 3600);
    await this.content.report(a.userId, body.subjectType, body.subjectId, body.message);
  }
}
