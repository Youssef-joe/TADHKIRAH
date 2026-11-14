import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDb, type DbHandle } from '@tadhkirah/db';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ENV],
      useFactory: (env: Env): DbHandle =>
        createDb(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
