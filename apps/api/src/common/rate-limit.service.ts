import { Inject, Injectable } from '@nestjs/common';
import { schema, sql, type DbHandle } from '@tadhkirah/db';
import { DB } from '../db/db.module.js';
import { AppError } from './http.js';

/**
 * Fixed-window rate limiting stored in Postgres (`auth.rate_limits`), so it is
 * shared by every API instance and survives restarts. Keys must not contain
 * personal data: hash emails before using them in a key.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStartSec = nowSec - (nowSec % windowSeconds);
    const [row] = await this.handle.db
      .insert(schema.rateLimits)
      .values({ key, windowStart: new Date(windowStartSec * 1000), count: 1 })
      .onConflictDoUpdate({
        target: [schema.rateLimits.key, schema.rateLimits.windowStart],
        set: { count: sql`${schema.rateLimits.count} + 1` },
      })
      .returning({ count: schema.rateLimits.count });

    if ((row?.count ?? 0) > limit) {
      throw new AppError(429, 'auth.rate_limited', 'Too many attempts. Please try again later.', {
        retryAfter: windowStartSec + windowSeconds - nowSec,
      });
    }
  }
}
