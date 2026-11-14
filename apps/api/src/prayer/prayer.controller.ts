import { Body, Controller, Get, HttpCode, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  OnboardingRequestSchema,
  PrayerSettingsSchema,
  PrayerTimesQuerySchema,
  type PrayerSettings,
  type PrayerTimesResponse,
} from '@tadhkirah/contracts';
import type { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PrayerService } from './prayer.service.js';

@Controller()
@UseGuards(SessionGuard)
export class PrayerController {
  constructor(private readonly prayer: PrayerService) {}

  @Put('me/prayer-settings')
  updateSettings(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(PrayerSettingsSchema)) body: PrayerSettings,
  ): Promise<PrayerSettings> {
    return this.prayer.updateSettings(auth.userId, body);
  }

  @Post('me/onboarding')
  @HttpCode(204)
  async onboarding(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(OnboardingRequestSchema)) body: z.output<typeof OnboardingRequestSchema>,
  ): Promise<void> {
    await this.prayer.completeOnboarding(auth.userId, body);
  }

  @Get('prayer-times')
  times(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodPipe(PrayerTimesQuerySchema)) q: z.output<typeof PrayerTimesQuerySchema>,
  ): Promise<PrayerTimesResponse> {
    return this.prayer.prayerTimes(auth.userId, q.from, q.to);
  }
}
