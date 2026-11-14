import { Global, Module } from '@nestjs/common';
import { RateLimitService } from '../common/rate-limit.service.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { createMailer, MAILER } from './mailer.js';
import { SessionGuard } from './session.guard.js';
import { SessionsService } from './sessions.service.js';

/** Global so any feature module can use `SessionGuard`. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    SessionGuard,
    RateLimitService,
    { provide: MAILER, inject: [ENV], useFactory: (env: Env) => createMailer(env) },
  ],
  exports: [SessionsService, SessionGuard, RateLimitService, MAILER],
})
export class AuthModule {}
