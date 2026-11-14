import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@tadhkirah/contracts';
import type { DbHandle } from '@tadhkirah/db';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';

/**
 * Health endpoints for Coolify/Docker. They live outside `/v1` because they're
 * infrastructure, not product API.
 */
@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: DbHandle,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Liveness: the process is up. No dependency checks, so a slow DB doesn't trigger restarts. */
  @Get('healthz')
  @HttpCode(200)
  live(): HealthResponse {
    return { status: 'ok', version: this.env.APP_VERSION };
  }

  /** Readiness: the process can serve traffic (the database is reachable). */
  @Get('readyz')
  async ready(): Promise<HealthResponse> {
    try {
      await this.db.pool.query('select 1');
      return { status: 'ok', version: this.env.APP_VERSION, checks: { database: 'ok' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'degraded',
        version: this.env.APP_VERSION,
        checks: { database: 'fail' },
      });
    }
  }
}
