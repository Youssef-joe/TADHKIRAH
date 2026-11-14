import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  UpdatePreferencesRequestSchema,
  UpdateProfileRequestSchema,
  type MeResponse,
  type Preferences,
  type Profile,
  type UpdatePreferencesRequest,
  type UpdateProfileRequest,
} from '@tadhkirah/contracts';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { MeService } from './me.service.js';

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    return this.me.get(auth.userId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(UpdateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<Profile> {
    return this.me.updateProfile(auth.userId, body);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(UpdatePreferencesRequestSchema)) body: UpdatePreferencesRequest,
  ): Promise<Preferences> {
    return this.me.updatePreferences(auth.userId, body);
  }
}
