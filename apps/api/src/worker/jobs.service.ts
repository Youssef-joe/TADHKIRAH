import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import type { DbHandle } from '@tadhkirah/db';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';
import { purgeExpired } from './purge.js';

export const QUEUES = {
  heartbeat: 'system.heartbeat',
  purge: 'maintenance.purge',
} as const;

/**
 * Owns the pg-boss instance in the worker process. The reminder planner and
 * dispatcher (M6) register here too.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private boss?: PgBoss;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly handle: DbHandle,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const boss = new PgBoss({ connectionString: this.env.DATABASE_URL, schema: 'pgboss' });
    boss.on('error', (err) => this.logger.error(err));
    await boss.start();
    this.boss = boss;

    await boss.createQueue(QUEUES.heartbeat);
    await boss.schedule(QUEUES.heartbeat, '*/5 * * * *', null, { tz: 'UTC' });
    await boss.work(QUEUES.heartbeat, async () => {
      this.logger.log('heartbeat');
    });

    // Retention policy (docs/03-data-model.md §5).
    await boss.createQueue(QUEUES.purge);
    await boss.schedule(QUEUES.purge, '17 * * * *', null, { tz: 'UTC' });
    await boss.work(QUEUES.purge, async () => {
      const counts = await purgeExpired(this.handle.db);
      this.logger.log({ counts }, 'purged expired records');
    });

    this.logger.log('worker started');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss?.stop({ graceful: true, timeout: 20_000 });
  }
}
