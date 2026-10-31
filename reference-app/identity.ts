import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Synthetic identity provider for the local reference app. It knows only the accounts handed to
 * it at startup (from the framework's environment variables), so no credential is ever stored in
 * source. Tokens are HS256 JWTs signed with a random key generated per process.
 */
export interface IdentityOptions {
  readonly users?: readonly { readonly username: string; readonly password: string }[];
  readonly clients?: readonly { readonly clientId: string; readonly clientSecret: string }[];
  readonly apiKeys?: readonly string[];
  readonly tokenTtlSeconds?: number;
  readonly portalSessionTtlSeconds?: number;
}

/**
 * Fixture rules: API users may read and write and may seed test data; service clients may only
 * read; a browser session of the patient portal gets only what the portal needs.
 */
export const SCOPES = {
  user: [
    'inventory:read',
    'inventory:write',
    'providers:read',
    'appointments:read',
    'appointments:write',
    'test-support:write',
  ],
  client: ['inventory:read', 'providers:read'],
  apiKey: ['inventory:read', 'inventory:write'],
  portal: ['providers:read', 'appointments:read', 'appointments:write'],
} as const;

/** Name of the patient-portal session cookie. */
export const PORTAL_SESSION_COOKIE = 'portal_session';

export interface Principal {
  readonly subject: string;
  readonly scopes: readonly string[];
}

export interface IssuedToken {
  readonly access_token: string;
  readonly token_type: 'Bearer';
  readonly expires_in: number;
  readonly scope: string;
}

export class IdentityProvider {
  private readonly signingKey = randomBytes(32);
  private readonly ttlSeconds: number;
  public readonly portalSessionTtlSeconds: number;
  private readonly sessions = new Map<string, { subject: string; expiresAt: number }>();

  public constructor(private readonly options: IdentityOptions = {}) {
    this.ttlSeconds = options.tokenTtlSeconds ?? 300;
    this.portalSessionTtlSeconds = options.portalSessionTtlSeconds ?? 1_800;
  }

  public passwordGrant(username: string, password: string): IssuedToken | undefined {
    return this.isKnownUser(username, password)
      ? this.issue(userSubject(username), SCOPES.user)
      : undefined;
  }

  /** Starts a patient-portal session; returns the opaque session ID, or undefined. */
  public startPortalSession(username: string, password: string): string | undefined {
    if (!this.isKnownUser(username, password)) {
      return undefined;
    }
    const sessionId = randomBytes(24).toString('base64url');
    this.sessions.set(sessionId, {
      subject: userSubject(username),
      expiresAt: Date.now() + this.portalSessionTtlSeconds * 1_000,
    });
    return sessionId;
  }

  public endPortalSession(sessionId: string | undefined): void {
    if (sessionId !== undefined) {
      this.sessions.delete(sessionId);
    }
  }

  /** Resolves a portal session ID to a principal; undefined when unknown or expired. */
  public portalPrincipal(sessionId: string | undefined): Principal | undefined {
    const session = sessionId === undefined ? undefined : this.sessions.get(sessionId);
    if (session === undefined || session.expiresAt <= Date.now()) {
      return undefined;
    }
    return { subject: session.subject, scopes: SCOPES.portal };
  }

  private isKnownUser(username: string, password: string): boolean {
    return (this.options.users ?? []).some(
      (user) => safeEqual(user.username, username) && safeEqual(user.password, password),
    );
  }

  public clientCredentialsGrant(clientId: string, clientSecret: string): IssuedToken | undefined {
    const known = (this.options.clients ?? []).some(
      (client) =>
        safeEqual(client.clientId, clientId) && safeEqual(client.clientSecret, clientSecret),
    );
    return known ? this.issue(`client-${digest(clientId)}`, SCOPES.client) : undefined;
  }

  /** Resolves a bearer token or API key to a principal; undefined when invalid or expired. */
  public authenticate(
    authorization: string | undefined,
    apiKey: string | undefined,
  ): Principal | undefined {
    if (apiKey !== undefined) {
      const valid = (this.options.apiKeys ?? []).some((key) => safeEqual(key, apiKey));
      return valid ? { subject: `key-${digest(apiKey)}`, scopes: SCOPES.apiKey } : undefined;
    }
    const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(authorization ?? '');
    return match?.[1] === undefined ? undefined : this.verify(match[1]);
  }

  private issue(subject: string, scopes: readonly string[]): IssuedToken {
    const now = Math.floor(Date.now() / 1_000);
    const payload = {
      iss: 'reference-app',
      sub: subject,
      scope: scopes.join(' '),
      iat: now,
      exp: now + this.ttlSeconds,
      jti: randomBytes(8).toString('hex'),
    };
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
    return {
      access_token: `${unsigned}.${this.sign(unsigned)}`,
      token_type: 'Bearer',
      expires_in: this.ttlSeconds,
      scope: payload.scope,
    };
  }

  private verify(token: string): Principal | undefined {
    const [header, payload, signature] = token.split('.');
    if (header === undefined || payload === undefined || signature === undefined) {
      return undefined;
    }
    if (!safeEqual(this.sign(`${header}.${payload}`), signature)) {
      return undefined;
    }
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof claims !== 'object' ||
      claims === null ||
      !('sub' in claims) ||
      !('scope' in claims) ||
      !('exp' in claims) ||
      typeof claims.sub !== 'string' ||
      typeof claims.scope !== 'string' ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Date.now() / 1_000
    ) {
      return undefined;
    }
    return { subject: claims.sub, scopes: claims.scope.split(' ') };
  }

  private sign(unsigned: string): string {
    return createHmac('sha256', this.signingKey).update(unsigned).digest('base64url');
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** The subject is a hash, so tokens and sessions never carry the (synthetic) e-mail address. */
function userSubject(username: string): string {
  return `user-${digest(username)}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/** Constant-time comparison; hashing first makes lengths equal. */
function safeEqual(expected: string, actual: string): boolean {
  const left = createHash('sha256').update(expected).digest();
  const right = createHash('sha256').update(actual).digest();
  return timingSafeEqual(left, right);
}
