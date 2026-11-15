import { Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { loggerParams } from '../common/logger.js';
import { ConfigModule } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { CryptoModule } from '../crypto/crypto.module.js';
import { DbModule } from '../db/db.module.js';
import { ReminderJobsModule } from '../reminders/reminders.module.js';
import { createMailer, MAILER } from '../auth/mailer.js';
import { ReviewDigestService } from '../content/review-digest.service.js';
import { ENV } from '../config/config.module.js';
import { JobsService } from './jobs.service.js';

/** Background jobs (MODE=worker): same codebase and image as the API, no HTTP server. */
@Module({})
export class WorkerModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot(loggerParams(env)),
        DbModule,
        CryptoModule,
        ReminderJobsModule,
      ],
      providers: [
        JobsService,
        ReviewDigestService,
        { provide: MAILER, inject: [ENV], useFactory: (e: Env) => createMailer(e) },
      ],
    };
  }
}
