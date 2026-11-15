import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateGoalSchema,
  LocalDateSchema,
  MonthlyReportQuerySchema,
  SaveWeeklyReviewSchema,
  UpdateGoalSchema,
  WeeklyReportQuerySchema,
  type GoalDto,
  type MonthlyReport,
  type UpdateGoal,
  type WeeklyReport,
  type WeeklyReviewDto,
} from '@tadhkirah/contracts';
import { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ReportsService } from './reports.service.js';

const DatePipe = new ZodPipe(LocalDateSchema);
const GoalsQuery = z.object({ status: z.enum(['active', 'done', 'let_go']).optional() });

/** Weekly and monthly reports, weekly reviews and goals. Reviews and goals contain decrypted private text: never cached. */
@Controller()
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/weekly')
  @Header('Cache-Control', 'no-store')
  weekly(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(WeeklyReportQuerySchema)) q: z.output<typeof WeeklyReportQuerySchema>,
  ): Promise<WeeklyReport> {
    return this.reports.weekly(auth.userId, q.weekStart);
  }

  @Get('reports/monthly')
  @Header('Cache-Control', 'no-store')
  monthly(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(MonthlyReportQuerySchema)) q: z.output<typeof MonthlyReportQuerySchema>,
  ): Promise<MonthlyReport> {
    return this.reports.monthly(auth.userId, q.calendar, q.month);
  }

  @Get('weekly-reviews/:weekStart')
  @Header('Cache-Control', 'no-store')
  review(
    @CurrentAuth() auth: AuthContext,
    @Param('weekStart', DatePipe) weekStart: string,
  ): Promise<WeeklyReviewDto> {
    return this.reports.getReview(auth.userId, weekStart);
  }

  @Put('weekly-reviews/:weekStart')
  @Header('Cache-Control', 'no-store')
  saveReview(
    @CurrentAuth() auth: AuthContext,
    @Param('weekStart', DatePipe) weekStart: string,
    @Body(new ZodPipe(SaveWeeklyReviewSchema)) body: z.output<typeof SaveWeeklyReviewSchema>,
  ): Promise<WeeklyReviewDto> {
    return this.reports.saveReview(auth.userId, weekStart, body);
  }

  @Get('goals')
  @Header('Cache-Control', 'no-store')
  goals(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(GoalsQuery)) q: z.output<typeof GoalsQuery>,
  ): Promise<GoalDto[]> {
    return this.reports.listGoals(auth.userId, q.status);
  }

  @Post('goals')
  createGoal(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(CreateGoalSchema)) body: z.output<typeof CreateGoalSchema>,
  ): Promise<GoalDto> {
    return this.reports.createGoal(auth.userId, body);
  }

  @Patch('goals/:id')
  updateGoal(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(UpdateGoalSchema)) body: UpdateGoal,
  ): Promise<GoalDto> {
    return this.reports.updateGoal(auth.userId, id, body);
  }
}
