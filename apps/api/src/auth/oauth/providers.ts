import { importPKCS8, SignJWT } from 'jose';
import type { Env } from '../../config/env.js';

export const OAUTH_PROVIDERS = ['google', 'apple'] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthProvider {
  id: OAuthProviderId;
  /** OpenID issuer; endpoints come from its discovery document. */
  issuer: string;
  /** `iss` values accepted in ID tokens. */
  acceptedIssuers: string[];
  clientId: string;
  scope: string;
  /** PKCE (RFC 7636). Apple doesn't document support, so it relies on state + nonce. */
  pkce: boolean;
  /** Apple returns with a cross-site POST when email is requested (response_mode=form_post). */
  formPost: boolean;
  extraParams: Record<string, string>;
  clientSecret(): Promise<string>;
}

/** The providers that have credentials configured. The rest stay hidden. */
export function configuredProviders(env: Env): Map<OAuthProviderId, OAuthProvider> {
  const out = new Map<OAuthProviderId, OAuthProvider>();

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const issuer = env.OAUTH_GOOGLE_ISSUER.replace(/\/$/, '');
    const secret = env.GOOGLE_CLIENT_SECRET;
    out.set('google', {
      id: 'google',
      issuer,
      // Google signs either form (OpenID Connect Core §15.6.2 note).
      acceptedIssuers: [issuer, issuer.replace(/^https:\/\//, '')],
      clientId: env.GOOGLE_CLIENT_ID,
      scope: 'openid email',
      pkce: true,
      formPost: false,
      extraParams: { prompt: 'select_account' },
      clientSecret: async () => secret,
    });
  }

  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    const issuer = env.OAUTH_APPLE_ISSUER.replace(/\/$/, '');
    const { APPLE_CLIENT_ID: clientId, APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId } = env;
    const pem = env.APPLE_PRIVATE_KEY;
    let key: ReturnType<typeof importPKCS8> | undefined;
    out.set('apple', {
      id: 'apple',
      issuer,
      acceptedIssuers: [issuer],
      clientId,
      scope: 'email',
      pkce: false,
      formPost: true,
      extraParams: {},
      // Apple's client secret is a short-lived ES256 JWT signed with the team's key.
      clientSecret: async () => {
        key ??= importPKCS8(pem, 'ES256');
        return new SignJWT({})
          .setProtectedHeader({ alg: 'ES256', kid: keyId })
          .setIssuer(teamId)
          .setSubject(clientId)
          .setAudience(issuer)
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(await key);
      },
    });
  }
  return out;
}
