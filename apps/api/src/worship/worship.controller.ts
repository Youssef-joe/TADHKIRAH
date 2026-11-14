import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCustomActivitySchema,
  DayFlagsSchema,
  LocalDateSchema,
  LogsQuerySchema,
  ReorderActivitiesSchema,
  UpdateActivitySchema,
  UpsertLogSchema,
  type ActivityDto,
  type DayFlagsDto,
  type LogDto,
  type LogsResponse,
  type UpdateActivity,
  type UpsertLog,
} from '@tadhkirah/contracts';
import type { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorshipService } from './worship.service.js';

const DatePipe = new ZodPipe(LocalDateSchema);

@Controller('worship')
@UseGuards(SessionGuard)
export class WorshipController {
  constructor(private readonly worship: WorshipService) {}

  @Get('activities')
  list(@CurrentAuth() auth: AuthContext): Promise<ActivityDto[]> {
    return this.worship.listActivities(auth.userId);
  }

  @Post('activities')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(CreateCustomActivitySchema))
    body: z.output<typeof CreateCustomActivitySchema>,
  ): Promise<ActivityDto> {
    return this.worship.createCustom(auth.userId, body);
  }

  @Put('activities/order')
  reorder(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(ReorderActivitiesSchema)) body: { ids: string[] },
  ): Promise<ActivityDto[]> {
    return this.worship.reorder(auth.userId, body.ids);
  }

  @Patch('activities/:id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(UpdateActivitySchema)) body: UpdateActivity,
  ): Promise<ActivityDto> {
    return this.worship.updateActivity(auth.userId, id, body);
  }

  @Delete('activities/:id')
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.worship.removeActivity(auth.userId, id);
  }

  @Get('logs')
  logs(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(LogsQuerySchema)) q: z.output<typeof LogsQuerySchema>,
  ): Promise<LogsResponse> {
    return this.worship.logs(auth.userId, q.from, q.to);
  }

  @Put('logs/:date/:activityId')
  upsertLog(
    @CurrentAuth() auth: AuthContext,
    @Param('date', DatePipe) date: string,
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body(new ZodPipe(UpsertLogSchema)) body: UpsertLog,
  ): Promise<LogDto> {
    return this.worship.upsertLog(auth.userId, date, activityId, body);
  }

  @Delete('logs/:date/:activityId')
  @HttpCode(204)
  async deleteLog(
    @CurrentAuth() auth: AuthContext,
    @Param('date', DatePipe) date: string,
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
  ): Promise<void> {
    await this.worship.deleteLog(auth.userId, date, activityId);
  }

  @Put('day-flags/:date')
  setFlags(
    @CurrentAuth() auth: AuthContext,
    @Param('date', DatePipe) date: string,
    @Body(new ZodPipe(DayFlagsSchema)) body: DayFlagsDto,
  ): Promise<DayFlagsDto> {
    return this.worship.setFlags(auth.userId, date, body);
  }
}
