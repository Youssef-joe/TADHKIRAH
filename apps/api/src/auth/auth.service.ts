import { Inject, Injectable, Logger } from '@nestjs/common';
import type { EmailVerifyRequest, Locale } from '@tadhkirah/contracts';
import { and, desc, eq, gt, isNull, schema, scopeToUser, sql, type DbHandle } from '@tadhkirah/db';
import { AppError } from '../common/http.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB } from '../db/db.module.js';
import { hmac, randomCode, randomToken, safeEqual } from './crypto.js';
import { signInEmail } from './emails.js';
import { MAILER, type Mailer } from './mailer.js';

const { emailTokens, users, userProfiles, userPreferences } = schema;

export const TOKEN_TTL_MS = 15 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 10;

const LIMITS = {
  startPerEmail: { limit: 5, window: 3600 },
  startPerIp: { limit: 20, window: 3600 },
  verifyPerIp: { limit: 30, window: 900 },
} as const;

export interface VerifiedUser {
  userId: string;
  email: string;
  isNew: boolean;
  locale: Locale;
}

/** Passwordless email sign-in: a magic link and a 6-digit code (Architecture §6). */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(ENV) private readonly env: Env,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * Sends a sign-in email. Responds the same way whether or not the account
   * exists, so nobody can find out who uses the app.
   */
  async start(email: string, locale: Locale, ip: string): Promise<void> {
    await this.rateLimit.hit(`start:ip:${ip}`, LIMITS.startPerIp.limit, LIMITS.startPerIp.window);
    const emailKey = hmac(this.env.AUTH_SECRET, 'ratelimit', email).toString('base64url');
    await this.rateLimit.hit(
      `start:email:${emailKey}`,
      LIMITS.startPerEmail.limit,
      LIMITS.startPerEmail.window,
    );

    const token = randomToken();
    const code = randomCode();
    await this.handle.db.insert(emailTokens).values({
      email,
      tokenHash: hmac(this.env.AUTH_SECRET, 'magic', token),
      codeHash: hmac(this.env.AUTH_SECRET, 'code', `${email}:${code}`),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    // The token goes in the URL fragment, which browsers never send to servers:
    // it stays out of access logs and Referer headers.
    const link = `${this.env.PUBLIC_WEB_URL}/${locale}/verify#token=${token}`;
    try {
      await this.mailer.send(signInEmail(email, locale, code, link));
    } catch (err) {
      this.logger.error(`sign-in email failed: ${(err as Error).message}`);
      throw new AppError(
        503,
        'auth.email_unavailable',
        'Could not send the email. Please try again.',
      );
    }
  }

  async verify(req: EmailVerifyRequest, ip: string): Promise<VerifiedUser> {
    await this.rateLimit.hit(
      `verify:ip:${ip}`,
      LIMITS.verifyPerIp.limit,
      LIMITS.verifyPerIp.window,
    );
    const email =
      'token' in req
        ? await this.consumeToken(req.token)
        : await this.consumeCode(req.email, req.code);
    if (!email)
      throw new AppError(400, 'auth.invalid_code', 'This code or link is invalid or has expired.');
    return this.findOrCreateUser(email, req.locale ?? 'ar', req.timeZone);
  }

  private async consumeToken(token: string): Promise<string | null> {
    const [row] = await this.handle.db
      .update(emailTokens)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(emailTokens.tokenHash, hmac(this.env.AUTH_SECRET, 'magic', token)),
          isNull(emailTokens.consumedAt),
          gt(emailTokens.expiresAt, sql`now()`),
        ),
      )
      .returning({ email: emailTokens.email });
    return row?.email ?? null;
  }

  /** Only the most recent active code for the email counts. Ten wrong tries burn it. */
  private async consumeCode(email: string, code: string): Promise<string | null> {
    const [row] = await this.handle.db
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.email, email),
          isNull(emailTokens.consumedAt),
          gt(emailTokens.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(emailTokens.createdAt))
      .limit(1);
    if (!row) return null;

    const expected = hmac(this.env.AUTH_SECRET, 'code', `${email}:${code}`);
    if (!safeEqual(expected, row.codeHash)) {
      const attempts = row.attempts + 1;
      await this.handle.db
        .update(emailTokens)
        .set({ attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { consumedAt: sql`now()` } : {}) })
        .where(eq(emailTokens.id, row.id));
      return null;
    }

    const consumed = await this.handle.db
      .update(emailTokens)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(emailTokens.id, row.id), isNull(emailTokens.consumedAt)))
      .returning({ id: emailTokens.id });
    return consumed.length ? email : null;
  }

  /**
   * Signs in a verified email: creates the account, profile and preferences in
   * one transaction on first sign-in. Also used by Google / Apple sign-in.
   */
  async findOrCreateUser(email: string, locale: Locale, timeZone?: string): Promise<VerifiedUser> {
    return this.handle.db.transaction(async (tx) => {
      const [found] = await tx
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(sql`lower(${users.email})`, email))
        .limit(1);
      // An account whose deletion is still finishing is never signed back into: finish it, start fresh.
      if (found?.status === 'pending_deletion')
        await tx.delete(users).where(eq(users.id, found.id));
      const existing = found?.status === 'active' ? found : undefined;

      if (existing) {
        await tx
          .update(users)
          .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
          .where(eq(users.id, existing.id));
        await scopeToUser(tx, existing.id);
        const [profile] = await tx
          .select({ locale: userProfiles.locale })
          .from(userProfiles)
          .where(eq(userProfiles.userId, existing.id));
        return { userId: existing.id, email, isNew: false, locale: profile?.locale ?? locale };
      }

      const [created] = await tx
        .insert(users)
        .values({ email, emailVerifiedAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: users.id });
      if (!created) {
        // Lost a race with a concurrent first sign-in. The transaction can't be reused, so ask the client to retry.
        throw new AppError(409, 'auth.retry', 'Please try again.');
      }
      await scopeToUser(tx, created.id);
      await tx.insert(userProfiles).values({
        userId: created.id,
        locale,
        digits: locale === 'ar' ? 'arab' : 'latn',
        ...(timeZone ? { timezone: timeZone } : {}),
      });
      await tx
        .insert(userPreferences)
        .values({ userId: created.id, weekStart: locale === 'ar' ? 6 : 1 });
      return { userId: created.id, email, isNew: true, locale };
    });
  }
}
