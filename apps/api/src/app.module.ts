import { Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { loggerParams } from './common/logger.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';

/** HTTP API (MODE=api). Product modules (auth, worship, reflection, …) are added here from M1 on. */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot(loggerParams(env)),
        DbModule,
        HealthModule,
      ],
    };
  }
}
