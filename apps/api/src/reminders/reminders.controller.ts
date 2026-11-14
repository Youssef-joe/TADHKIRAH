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
  UseGuards,
} from '@nestjs/common';
import {
  CreateCustomReminderSchema,
  NotificationPrefsSchema,
  PushSubscriptionSchema,
  SnoozeSchema,
  UpdateReminderRuleSchema,
  type InboxItem,
  type NotificationPrefsDto,
  type ReminderRuleDto,
  type UpcomingReminder,
  type UpdateReminderRule,
} from '@tadhkirah/contracts';
import { z } from 'zod';
import { SessionGuard } from '../auth/session.guard.js';
import { CurrentAuth, type AuthContext } from '../common/http.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RemindersService } from './reminders.service.js';

const EndpointBody = z.object({ endpoint: z.url().max(1000) });

@Controller()
export class PushKeyController {
  constructor(private readonly reminders: RemindersService) {}

  /** Public: the browser needs it before it can subscribe. */
  @Get('push/vapid-public-key')
  key() {
    return this.reminders.vapidPublicKey();
  }
}

@Controller()
@UseGuards(SessionGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get('reminders/rules')
  @Header('Cache-Control', 'no-store')
  rules(@CurrentAuth() auth: AuthContext): Promise<ReminderRuleDto[]> {
    return this.reminders.listRules(auth.userId);
  }

  @Post('reminders/rules')
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(CreateCustomReminderSchema))
    body: z.output<typeof CreateCustomReminderSchema>,
  ): Promise<ReminderRuleDto> {
    return this.reminders.createCustom(auth.userId, body);
  }

  @Patch('reminders/rules/:id')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(UpdateReminderRuleSchema)) body: UpdateReminderRule,
  ): Promise<ReminderRuleDto> {
    return this.reminders.updateRule(auth.userId, id, body);
  }

  @Delete('reminders/rules/:id')
  @HttpCode(204)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.reminders.removeCustom(auth.userId, id);
  }

  @Get('reminders/upcoming')
  upcoming(@CurrentAuth() auth: AuthContext): Promise<UpcomingReminder[]> {
    return this.reminders.upcoming(auth.userId);
  }

  @Post('reminders/:id/snooze')
  snooze(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(SnoozeSchema)) body: { minutes: number },
  ) {
    return this.reminders.snooze(auth.userId, id, body.minutes);
  }

  @Get('me/notification-preferences')
  prefs(@CurrentAuth() auth: AuthContext): Promise<NotificationPrefsDto> {
    return this.reminders.getPrefs(auth.userId);
  }

  @Put('me/notification-preferences')
  setPrefs(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(NotificationPrefsSchema)) body: NotificationPrefsDto,
  ): Promise<NotificationPrefsDto> {
    return this.reminders.setPrefs(auth.userId, body);
  }

  @Get('devices')
  devices(@CurrentAuth() auth: AuthContext) {
    return this.reminders.devices(auth.userId);
  }

  @Post('devices')
  register(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(PushSubscriptionSchema)) body: z.output<typeof PushSubscriptionSchema>,
  ) {
    return this.reminders.registerDevice(auth.userId, body);
  }

  @Post('devices/unsubscribe')
  @HttpCode(204)
  async unregister(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(EndpointBody)) body: { endpoint: string },
  ) {
    await this.reminders.removeDevice(auth.userId, body.endpoint);
  }

  @Get('notifications')
  @Header('Cache-Control', 'no-store')
  inbox(@CurrentAuth() auth: AuthContext): Promise<InboxItem[]> {
    return this.reminders.inbox(auth.userId);
  }

  @Post('notifications/:id/opened')
  @HttpCode(204)
  async opened(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.reminders.markOpened(auth.userId, id);
  }
}
