import { Controller, Get, Headers, Inject, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { DbHandle } from '@tadhkirah/db';
import { AppError } from '../common/http.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';
import { purgeExpired } from '../worker/purge.js';

/**
 * Scheduled jobs triggered over HTTP, for serverless hosting (Vercel Cron) where
 * there is no always-on worker. They're protected by CRON_SECRET and safe to run
 * any number of times. Self-hosted deployments run the same jobs in the pg-boss worker.
 */
@Controller('internal/cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly handle: DbHandle,
  ) {}

  @Get('purge')
  async purge(@Headers('authorization') authorization?: string): Promise<Record<string, number>> {
    this.authorize(authorization);
    const counts = await purgeExpired(this.handle.db);
    this.logger.log({ counts }, 'purged expired records');
    return counts;
  }

  private authorize(header: string | undefined): void {
    const secret = this.env.CRON_SECRET;
    // Without a configured secret the endpoints don't exist.
    if (!secret) throw new AppError(404, 'not_found');
    const expected = Buffer.from(`Bearer ${secret}`);
    const given = Buffer.from(header ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new AppError(401, 'auth.unauthenticated');
    }
  }
}
