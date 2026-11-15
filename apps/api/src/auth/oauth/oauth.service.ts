import { Inject, Injectable, Logger } from '@nestjs/common';
import { API_VERSION, type LinkedIdentity, type Locale } from '@tadhkirah/contracts';
import { and, desc, eq, schema, sql, type DbHandle } from '@tadhkirah/db';
import { isValidTimeZone } from '@tadhkirah/domain';
import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { DB } from '../../db/db.module.js';
import { AuthService, type VerifiedUser } from '../auth.service.js';
import { hmac, randomToken, safeEqual } from '../crypto.js';
import { configuredProviders, type OAuthProvider, type OAuthProviderId } from './providers.js';

const { oauthIdentities, users } = schema;

export const FLOW_TTL_MS = 10 * 60 * 1000;

/** Why a sign-in didn't finish; shown on the sign-in page as `?oauth=<reason>`. */
export type OAuthFailure = 'cancelled' | 'expired' | 'unverified' | 'failed';
export class OAuthError extends Error {
  constructor(
    readonly reason: OAuthFailure,
    detail?: string,
  ) {
    super(detail ?? reason);
  }
}

/** What the browser carries between "start" and "callback", in a signed cookie. */
interface Flow {
  p: OAuthProviderId;
  state: string;
  nonce: string;
  verifier?: string;
  locale: Locale;
  tz?: string;
  exp: number;
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * Sign in with Google or Apple (ACC-2): OpenID Connect authorization code flow
 * with state, nonce and (Google) PKCE. The ID token is verified against the
 * provider's published keys. Only the stable subject id and a verified email are
 * used; provider tokens are discarded right away.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly providers: Map<OAuthProviderId, OAuthProvider>;
  private readonly discovered = new Map<string, { doc: Discovery; at: number }>();
  private readonly keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly handle: DbHandle,
    private readonly auth: AuthService,
  ) {
    this.providers = configuredProviders(env);
  }

  enabled(): OAuthProviderId[] {
    return [...this.providers.keys()];
  }

  has(id: string): id is OAuthProviderId {
    return this.providers.has(id as OAuthProviderId);
  }

  redirectUri(id: OAuthProviderId): string {
    return `${this.env.PUBLIC_WEB_URL}/${API_VERSION}/auth/oauth/${id}/callback`;
  }

  /** The provider's authorization URL, and the signed flow cookie to set. */
  async start(
    id: OAuthProviderId,
    locale: Locale,
    tz?: string,
  ): Promise<{ url: string; cookie: string }> {
    const p = this.providers.get(id)!;
    const doc = await this.discover(p.issuer);
    const flow: Flow = {
      p: id,
      state: randomToken(),
      nonce: randomToken(),
      locale,
      ...(tz && isValidTimeZone(tz) ? { tz } : {}),
      exp: Date.now() + FLOW_TTL_MS,
    };
    const params = new URLSearchParams({
      client_id: p.clientId,
      redirect_uri: this.redirectUri(id),
      response_type: 'code',
      scope: p.scope,
      state: flow.state,
      nonce: flow.nonce,
      ...p.extraParams,
    });
    if (p.pkce) {
      flow.verifier = randomToken();
      params.set('code_challenge', b64url(createHash('sha256').update(flow.verifier).digest()));
      params.set('code_challenge_method', 'S256');
    }
    if (p.formPost) params.set('response_mode', 'form_post');
    return { url: `${doc.authorization_endpoint}?${params}`, cookie: this.seal(flow) };
  }

  /** The locale a flow started in, for redirecting even when the callback fails. */
  flowLocale(cookie: string | undefined): Locale {
    return this.unseal(cookie)?.locale ?? 'ar';
  }

  async callback(
    id: OAuthProviderId,
    input: { code?: unknown; state?: unknown; error?: unknown },
    cookie: string | undefined,
  ): Promise<VerifiedUser> {
    const flow = this.unseal(cookie);
    if (!flow || flow.p !== id || flow.exp < Date.now()) throw new OAuthError('expired');
    if (input.error) {
      const e = String(input.error);
      throw new OAuthError(
        e === 'access_denied' || e === 'user_cancelled_authorize' ? 'cancelled' : 'failed',
        e,
      );
    }
    const state = typeof input.state === 'string' ? input.state : '';
    if (!safeEqual(Buffer.from(state), Buffer.from(flow.state)))
      throw new OAuthError('failed', 'state mismatch');
    if (typeof input.code !== 'string' || !input.code)
      throw new OAuthError('failed', 'missing code');

    const p = this.providers.get(id)!;
    const claims = await this.exchange(p, input.code, flow);
    if (claims.nonce !== flow.nonce) throw new OAuthError('failed', 'nonce mismatch');
    if (!claims.sub) throw new OAuthError('failed', 'missing subject');
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null;
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    return this.resolveUser(id, claims.sub, email, verified, flow);
  }

  /**
   * Same subject → same account. A first-time subject joins the account with
   * the same verified email (the provider has proved ownership, as our code
   * would), or starts a new one.
   */
  private async resolveUser(
    provider: OAuthProviderId,
    subject: string,
    email: string | null,
    verified: boolean,
    flow: Flow,
  ): Promise<VerifiedUser> {
    const [linked] = await this.handle.db
      .select({ email: users.email })
      .from(oauthIdentities)
      .innerJoin(users, eq(users.id, oauthIdentities.userId))
      .where(
        sql`${oauthIdentities.provider} = ${provider} and ${oauthIdentities.subject} = ${subject}`,
      );
    const accountEmail = linked?.email ?? (email && verified ? email : null);
    if (!accountEmail) throw new OAuthError('unverified');

    const user = await this.auth.findOrCreateUser(accountEmail, flow.locale, flow.tz);
    await this.handle.db
      .insert(oauthIdentities)
      .values({ userId: user.userId, provider, subject, email })
      .onConflictDoUpdate({
        target: [oauthIdentities.provider, oauthIdentities.subject],
        set: { userId: user.userId, lastUsedAt: sql`now()`, ...(email ? { email } : {}) },
      });
    return user;
  }

  private async exchange(p: OAuthProvider, code: string, flow: Flow): Promise<JWTPayload> {
    const doc = await this.discover(p.issuer);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(p.id),
      client_id: p.clientId,
      client_secret: await p.clientSecret(),
      ...(flow.verifier ? { code_verifier: flow.verifier } : {}),
    });
    const res = await fetch(doc.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
    if (!res.ok || !json.id_token) {
      // The provider's error code only: never the response body, which can hold tokens.
      throw new OAuthError('failed', `token endpoint ${res.status} ${json.error ?? ''}`.trim());
    }
    let keys = this.keySets.get(doc.jwks_uri);
    if (!keys) this.keySets.set(doc.jwks_uri, (keys = createRemoteJWKSet(new URL(doc.jwks_uri))));
    try {
      const { payload } = await jwtVerify(json.id_token, keys, {
        issuer: p.acceptedIssuers,
        audience: p.clientId,
        clockTolerance: 60,
      });
      return payload;
    } catch (err) {
      throw new OAuthError('failed', `id token: ${(err as Error).message}`);
    }
  }

  private async discover(issuer: string): Promise<Discovery> {
    const hit = this.discovered.get(issuer);
    if (hit && Date.now() - hit.at < 3600_000) return hit.doc;
    const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new OAuthError('failed', `discovery ${res.status}`);
    const doc = (await res.json()) as Discovery;
    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri)
      throw new OAuthError('failed', 'incomplete discovery document');
    this.discovered.set(issuer, { doc, at: Date.now() });
    return doc;
  }

  private seal(flow: Flow): string {
    const payload = b64url(JSON.stringify(flow));
    return `${payload}.${b64url(hmac(this.env.AUTH_SECRET, 'oauth', payload))}`;
  }

  private unseal(cookie: string | undefined): Flow | null {
    if (!cookie) return null;
    const [payload, sig] = cookie.split('.');
    if (!payload || !sig) return null;
    if (!safeEqual(Buffer.from(sig, 'base64url'), hmac(this.env.AUTH_SECRET, 'oauth', payload)))
      return null;
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString()) as Flow;
    } catch {
      return null;
    }
  }

  /** Google / Apple accounts linked to a user (settings). */
  async list(userId: string): Promise<LinkedIdentity[]> {
    const rows = await this.handle.db
      .select()
      .from(oauthIdentities)
      .where(eq(oauthIdentities.userId, userId))
      .orderBy(desc(oauthIdentities.createdAt));
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      email: r.email,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt.toISOString(),
    }));
  }

  /** Unlinking is always safe: the account's email can still sign in with a code. */
  async unlink(userId: string, id: string): Promise<boolean> {
    const gone = await this.handle.db
      .delete(oauthIdentities)
      .where(and(eq(oauthIdentities.id, id), eq(oauthIdentities.userId, userId)))
      .returning({ id: oauthIdentities.id });
    return gone.length > 0;
  }

  logFailure(id: string, err: unknown): void {
    if (err instanceof OAuthError && (err.reason === 'cancelled' || err.reason === 'expired'))
      return;
    this.logger.warn(`${id} sign-in failed: ${(err as Error).message}`);
  }
}
