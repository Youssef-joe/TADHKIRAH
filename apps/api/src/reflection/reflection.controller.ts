import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  CreateQuestionSchema,
  LocalDateSchema,
  LogsQuerySchema,
  ReorderQuestionsSchema,
  SaveReflectionSchema,
  UpdateQuestionSchema,
  type ReflectionDayResponse,
  type ReflectionDto,
  type ReflectionQuestionDto,
  type UpdateQuestion,
} from '@tadhkirah/contracts';
import type { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ReflectionService } from './reflection.service.js';

const DatePipe = new ZodPipe(LocalDateSchema);

/** Responses contain decrypted private text: never cache them anywhere. */
@Controller()
@UseGuards(SessionGuard)
export class ReflectionController {
  constructor(private readonly reflection: ReflectionService) {}

  @Get('reflection/questions')
  @Header('Cache-Control', 'no-store')
  questions(@CurrentAuth() auth: AuthContext): Promise<ReflectionQuestionDto[]> {
    return this.reflection.listQuestions(auth.userId);
  }

  @Post('reflection/questions')
  createQuestion(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(CreateQuestionSchema)) body: z.output<typeof CreateQuestionSchema>,
  ): Promise<ReflectionQuestionDto> {
    return this.reflection.createQuestion(auth.userId, body);
  }

  @Put('reflection/questions/order')
  reorder(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(ReorderQuestionsSchema)) body: { ids: string[] },
  ): Promise<ReflectionQuestionDto[]> {
    return this.reflection.reorderQuestions(auth.userId, body.ids);
  }

  @Patch('reflection/questions/:id')
  updateQuestion(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(UpdateQuestionSchema)) body: UpdateQuestion,
  ): Promise<ReflectionQuestionDto> {
    return this.reflection.updateQuestion(auth.userId, id, body);
  }

  @Delete('reflection/questions/:id')
  @HttpCode(204)
  async removeQuestion(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.reflection.removeQuestion(auth.userId, id);
  }

  @Get('reflections')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(LogsQuerySchema)) q: z.output<typeof LogsQuerySchema>,
  ) {
    return this.reflection.list(auth.userId, q.from, q.to);
  }

  @Get('reflections/:date')
  @Header('Cache-Control', 'no-store')
  day(
    @CurrentAuth() auth: AuthContext,
    @Param('date', DatePipe) date: string,
  ): Promise<ReflectionDayResponse> {
    return this.reflection.day(auth.userId, date);
  }

  @Get('reflections/:date/intention')
  @Header('Cache-Control', 'no-store')
  intention(@CurrentAuth() auth: AuthContext, @Param('date', DatePipe) date: string) {
    return this.reflection.intention(auth.userId, date);
  }

  @Put('reflections/:date')
  @Header('Cache-Control', 'no-store')
  save(
    @CurrentAuth() auth: AuthContext,
    @Param('date', DatePipe) date: string,
    @Body(new ZodPipe(SaveReflectionSchema)) body: z.output<typeof SaveReflectionSchema>,
  ): Promise<ReflectionDto> {
    return this.reflection.save(auth.userId, date, body);
  }

  @Delete('reflections/:date')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('date', DatePipe) date: string) {
    await this.reflection.remove(auth.userId, date);
  }
}
