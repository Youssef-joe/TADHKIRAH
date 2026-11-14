import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { CsrfGuard } from './common/csrf.guard.js';
import { loggerParams } from './common/logger.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { MeModule } from './me/me.module.js';
import { PrayerModule } from './prayer/prayer.module.js';

/** HTTP API (MODE=api). */
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
        AuthModule,
        PrayerModule,
        MeModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
    };
  }
}
