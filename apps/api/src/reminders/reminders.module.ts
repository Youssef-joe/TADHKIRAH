import { Global, Module } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DispatcherService } from './dispatcher.service.js';
import { PlannerService } from './planner.service.js';
import { createPushChannel, PUSH_CHANNEL } from './push.channel.js';
import { PushKeyController, RemindersController } from './reminders.controller.js';
import { RemindersService } from './reminders.service.js';

@Global()
@Module({
  controllers: [PushKeyController, RemindersController],
  providers: [
    RemindersService,
    PlannerService,
    DispatcherService,
    { provide: PUSH_CHANNEL, inject: [ENV], useFactory: (env: Env) => createPushChannel(env) },
  ],
  exports: [PlannerService, DispatcherService, PUSH_CHANNEL],
})
export class RemindersModule {}

/** The background-job half only (for the self-hosted worker process: no HTTP controllers). */
@Global()
@Module({
  providers: [
    PlannerService,
    DispatcherService,
    { provide: PUSH_CHANNEL, inject: [ENV], useFactory: (env: Env) => createPushChannel(env) },
  ],
  exports: [PlannerService, DispatcherService],
})
export class ReminderJobsModule {}
