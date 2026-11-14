import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateRecitationSchema,
  CreateRevisionSchema,
  UpdateMemorizationSchema,
  type MemorizationDto,
  type QuranSummary,
  type RecitationDto,
  type RevisionDto,
} from '@tadhkirah/contracts';
import type { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { AppError, CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { QuranService } from './quran.service.js';

@Controller('quran')
@UseGuards(SessionGuard)
export class QuranController {
  constructor(private readonly quran: QuranService) {}

  @Get('summary')
  summary(@CurrentAuth() auth: AuthContext): Promise<QuranSummary> {
    return this.quran.summary(auth.userId);
  }

  @Post('recitations')
  addRecitation(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(CreateRecitationSchema)) body: z.output<typeof CreateRecitationSchema>,
  ): Promise<RecitationDto> {
    return this.quran.addRecitation(auth.userId, body);
  }

  @Delete('recitations/:id')
  @HttpCode(204)
  async deleteRecitation(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.quran.deleteRecitation(auth.userId, id);
  }

  @Get('memorization')
  memorization(@CurrentAuth() auth: AuthContext): Promise<MemorizationDto[]> {
    return this.quran.listMemorization(auth.userId);
  }

  @Put('memorization/:surah')
  setMemorization(
    @CurrentAuth() auth: AuthContext,
    @Param('surah', ParseIntPipe) surah: number,
    @Body(new ZodPipe(UpdateMemorizationSchema)) body: z.output<typeof UpdateMemorizationSchema>,
  ): Promise<MemorizationDto> {
    if (surah < 1 || surah > 114) throw new AppError(404, 'not_found');
    return this.quran.setMemorization(auth.userId, surah, body);
  }

  @Post('revisions')
  addRevision(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(CreateRevisionSchema)) body: z.output<typeof CreateRevisionSchema>,
  ): Promise<RevisionDto> {
    return this.quran.addRevision(auth.userId, body);
  }

  @Delete('revisions/:id')
  @HttpCode(204)
  async deleteRevision(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.quran.deleteRevision(auth.userId, id);
  }
}
