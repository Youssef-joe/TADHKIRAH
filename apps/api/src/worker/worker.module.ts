import { Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { loggerParams } from '../common/logger.js';
import { ConfigModule } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DbModule } from '../db/db.module.js';
import { JobsService } from './jobs.service.js';

/** Background jobs (MODE=worker): same codebase and image as the API, no HTTP server. */
@Module({})
export class WorkerModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: WorkerModule,
      imports: [ConfigModule.forRoot(env), LoggerModule.forRoot(loggerParams(env)), DbModule],
      providers: [JobsService],
    };
  }
}
