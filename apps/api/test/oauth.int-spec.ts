import type { INestApplication } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
  type JWTPayload,
} from 'jose';
import request from 'supertest';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { sessionCookie, signIn, startApp, TEST_ORIGIN, uniqueEmail, uniqueIp } from './helpers.js';

const GOOGLE_ID = 'google-client-id-123';
const GOOGLE_SECRET = 'google-client-secret-123';
const APPLE_ID = 'org.tadhkirah.web';

type Grant = { claims: JWTPayload; challenge?: string; redirectUri: string };

/**
 * A stand-in OpenID provider: discovery, JWKS, and a token endpoint that checks
 * the client's credentials, the redirect URI and PKCE before issuing a signed ID
 * token. Tests "consent" by registering a grant for a code.
 */
async function fakeProvider(kind: 'google' | 'apple', appleKey?: JWK) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const grants = new Map<string, Grant>();
  let base = '';

  const server: Server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? '/', base);
    if (url.pathname === '/.well-known/openid-configuration')
      return send(200, {
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        jwks_uri: `${base}/jwks`,
      });
    if (url.pathname === '/jwks') return send(200, { keys: [jwk] });
    if (url.pathname !== '/token' || req.method !== 'POST') return send(404, {});
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const f = new URLSearchParams(raw);
      const grant = grants.get(f.get('code') ?? '');
      grants.delete(f.get('code') ?? '');
      if (!grant || f.get('redirect_uri') !== grant.redirectUri)
        return send(400, { error: 'invalid_grant' });
      if (kind === 'google') {
        if (f.get('client_id') !== GOOGLE_ID || f.get('client_secret') !== GOOGLE_SECRET)
          return send(401, { error: 'invalid_client' });
        const verifier = f.get('code_verifier') ?? '';
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        if (challenge !== grant.challenge) return send(400, { error: 'invalid_grant' });
      } else {
        try {
          await jwtVerify(f.get('client_secret') ?? '', await importJWK(appleKey!, 'ES256'), {
            issuer: 'TEAM123',
            subject: APPLE_ID,
            audience: base,
          });
        } catch {
          return send(401, { error: 'invalid_client' });
        }
      }
      const idToken = await new SignJWT(grant.claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(base)
        .setAudience(kind === 'google' ? GOOGLE_ID : APPLE_ID)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      send(200, { access_token: 'unused', id_token: idToken, token_type: 'Bearer' });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, grants, close: () => new Promise((r) => server.close(r)) };
}

describe('sign in with Google / Apple (ACC-2)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  let google: Awaited<ReturnType<typeof fakeProvider>>;
  let apple: Awaited<ReturnType<typeof fakeProvider>>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const appleKeys = await generateKeyPair('ES256', { extractable: true });
    google = await fakeProvider('google');
    apple = await fakeProvider('apple', await exportJWK(appleKeys.publicKey));
    ({ app, mailer } = await startApp({
      GOOGLE_CLIENT_ID: GOOGLE_ID,
      GOOGLE_CLIENT_SECRET: GOOGLE_SECRET,
      OAUTH_GOOGLE_ISSUER: google.base,
      APPLE_CLIENT_ID: APPLE_ID,
      APPLE_TEAM_ID: 'TEAM123',
      APPLE_KEY_ID: 'KEY123',
      // Escaped newlines, as a key pasted into a dashboard often arrives.
      APPLE_PRIVATE_KEY: (await exportPKCS8(appleKeys.privateKey)).replace(/\n/g, '\\n'),
      OAUTH_APPLE_ISSUER: apple.base,
    }));
  });
  afterAll(async () => {
    await app?.close();
    await google?.close();
    await apple?.close();
  });

  /** "start": returns the provider's authorize parameters and the flow cookie. */
  async function start(provider: 'google' | 'apple', ip: string, locale = 'en') {
    const res = await http()
      .get(`/v1/auth/oauth/${provider}/start?locale=${locale}&tz=Asia/Riyadh`)
      .set('X-Forwarded-For', ip)
      .expect(303);
    const location = new URL(res.headers.location as string);
    const flowCookie = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('tadhkirah_oauth='))!
      .split(';')[0]!;
    return { location, params: location.searchParams, flowCookie };
  }

  /** The user consents at the provider: register what the provider will say about them. */
  function consent(
    p: Awaited<ReturnType<typeof fakeProvider>>,
    params: URLSearchParams,
    claims: JWTPayload,
  ) {
    const code = randomBytes(8).toString('hex');
    p.grants.set(code, {
      claims: { nonce: params.get('nonce')!, ...claims },
      challenge: params.get('code_challenge') ?? undefined,
      redirectUri: params.get('redirect_uri')!,
    });
    return code;
  }

  async function googleSignIn(claims: JWTPayload) {
    const ip = uniqueIp();
    const { params, flowCookie } = await start('google', ip);
    const code = consent(google, params, claims);
    return http()
      .get(`/v1/auth/oauth/google/callback?code=${code}&state=${params.get('state')}`)
      .set('Cookie', flowCookie)
      .set('X-Forwarded-For', ip)
      .expect(303);
  }

  const me = (cookie: string) => http().get('/v1/me').set('Cookie', cookie).expect(200);

  it('lists the configured providers and refuses unknown ones', async () => {
    const res = await http().get('/v1/auth/providers').expect(200);
    expect(res.body.providers.sort()).toEqual(['apple', 'google']);
    await http().get('/v1/auth/oauth/github/start').expect(404);
  });

  it('sends the browser to Google with state, nonce and PKCE (S256)', async () => {
    const { location, params, flowCookie } = await start('google', uniqueIp());
    expect(location.origin + location.pathname).toBe(`${google.base}/authorize`);
    expect(params.get('client_id')).toBe(GOOGLE_ID);
    expect(params.get('redirect_uri')).toBe(`${TEST_ORIGIN}/v1/auth/oauth/google/callback`);
    expect(params.get('scope')).toBe('openid email');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('state')).toHaveLength(43);
    expect(params.get('nonce')).toHaveLength(43);
    // The flow cookie is signed, scoped to the OAuth routes and short-lived.
    expect(flowCookie).toMatch(/^tadhkirah_oauth=[\w-]+\.[\w-]+$/);
  });

  it('creates an account on first Google sign-in and opens the app', async () => {
    const email = uniqueEmail();
    const res = await googleSignIn({ sub: `g-${email}`, email, email_verified: true });
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/en/verify#signed-in`);
    const cookie = sessionCookie(res);
    expect((await me(cookie)).body.email).toBe(email);
    const ids = await http().get('/v1/auth/identities').set('Cookie', cookie).expect(200);
    expect(ids.body).toMatchObject([{ provider: 'google', email }]);
  });

  it('joins an existing account with the same verified email, and keeps the link by subject', async () => {
    const { cookie: emailCookie, email } = await signIn(app, mailer);
    const userId = (await me(emailCookie)).body.id;
    const sub = `g-${randomBytes(4).toString('hex')}`;

    const first = await googleSignIn({ sub, email: email.toUpperCase(), email_verified: true });
    expect((await me(sessionCookie(first))).body.id).toBe(userId);

    // Later the Google account's email changes: the subject still finds the same account.
    const later = await googleSignIn({ sub, email: uniqueEmail(), email_verified: true });
    expect((await me(sessionCookie(later))).body.id).toBe(userId);
  });

  it('refuses an unverified email instead of guessing the account', async () => {
    const email = uniqueEmail();
    const res = await googleSignIn({ sub: `g-${email}`, email, email_verified: false });
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/en/sign-in?oauth=unverified`);
    expect(res.headers['set-cookie']?.toString() ?? '').not.toContain('tadhkirah_session=');
  });

  it('rejects a forged state, a missing flow cookie and a tampered one', async () => {
    const ip = uniqueIp();
    const { params, flowCookie } = await start('google', ip);
    const code = consent(google, params, { sub: 'x', email: uniqueEmail(), email_verified: true });
    const callback = (state: string, cookie?: string) => {
      const r = http()
        .get(`/v1/auth/oauth/google/callback?code=${code}&state=${state}`)
        .set('X-Forwarded-For', ip);
      return (cookie ? r.set('Cookie', cookie) : r).expect(303);
    };
    expect((await callback('forged', flowCookie)).headers.location).toContain('?oauth=failed');
    expect((await callback(params.get('state')!)).headers.location).toContain('?oauth=expired');
    const tampered = flowCookie.replace(/\.[\w-]+$/, '.AAAA');
    expect((await callback(params.get('state')!, tampered)).headers.location).toContain(
      '?oauth=expired',
    );
  });

  it('rejects an ID token issued for a different nonce (replay)', async () => {
    const ip = uniqueIp();
    const { params, flowCookie } = await start('google', ip);
    const email = uniqueEmail();
    const code = consent(google, params, { sub: 's', email, email_verified: true, nonce: 'old' });
    const res = await http()
      .get(`/v1/auth/oauth/google/callback?code=${code}&state=${params.get('state')}`)
      .set('Cookie', flowCookie)
      .set('X-Forwarded-For', ip)
      .expect(303);
    expect(res.headers.location).toContain('?oauth=failed');
  });

  it('treats "cancel" at the provider gently', async () => {
    const ip = uniqueIp();
    const { params, flowCookie } = await start('google', ip, 'ar');
    const res = await http()
      .get(`/v1/auth/oauth/google/callback?error=access_denied&state=${params.get('state')}`)
      .set('Cookie', flowCookie)
      .set('X-Forwarded-For', ip)
      .expect(303);
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/ar/sign-in?oauth=cancelled`);
  });

  it('accepts Apple’s cross-site form_post callback with a signed client secret', async () => {
    const ip = uniqueIp();
    const { params, flowCookie } = await start('apple', ip, 'ar');
    expect(params.get('response_mode')).toBe('form_post');
    expect(params.get('code_challenge')).toBeNull();
    const email = `relay-${randomBytes(4).toString('hex')}@privaterelay.appleid.com`;
    const code = consent(apple, params, { sub: `a-${email}`, email, email_verified: 'true' });
    const res = await http()
      .post('/v1/auth/oauth/apple/callback')
      .set('Origin', 'https://appleid.apple.com')
      .set('Cookie', flowCookie)
      .set('X-Forwarded-For', ip)
      .type('form')
      .send({ code, state: params.get('state') })
      .expect(303);
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/ar/verify#signed-in`);
    expect((await me(sessionCookie(res))).body.email).toBe(email);
  });

  it('still blocks other cross-site posts (CSRF)', async () => {
    await http()
      .post('/v1/auth/email/start')
      .set('Origin', 'https://appleid.apple.com')
      .send({ email: uniqueEmail() })
      .expect(403);
  });

  it('unlinks a provider; email sign-in keeps working', async () => {
    const email = uniqueEmail();
    const res = await googleSignIn({ sub: `g-${email}`, email, email_verified: true });
    const cookie = sessionCookie(res);
    const [identity] = (await http().get('/v1/auth/identities').set('Cookie', cookie)).body;
    await http()
      .delete(`/v1/auth/identities/${identity.id}`)
      .set('Cookie', cookie)
      .set('x-tadhkirah-csrf', '1')
      .expect(204);
    expect((await http().get('/v1/auth/identities').set('Cookie', cookie)).body).toEqual([]);
    const again = await signIn(app, mailer, email);
    expect((await me(again.cookie)).body.email).toBe(email);
  });
});
