import { AuthenticationError } from '@core/errors';
import type { Redactor, Secret } from '@core/security';
import type { HttpClient } from '../http-client';
import type { ContractSchema, SchemaValidator } from '../schema-validator';
import type { AuthStrategy } from './auth-strategy';

export type OAuth2Grant =
  | {
      readonly type: 'password';
      readonly username: Secret;
      readonly password: Secret;
      readonly clientId?: Secret;
      readonly clientSecret?: Secret;
    }
  | {
      readonly type: 'client_credentials';
      readonly clientId: Secret;
      readonly clientSecret: Secret;
    };

export interface OAuth2TokenAuthOptions {
  /** Unauthenticated client whose base URL is `auth.baseUrl`. */
  readonly tokenClient: HttpClient;
  readonly tokenPath: string;
  /** Resolved on first use, so scenarios that never authenticate never need the secrets. */
  readonly grant: () => OAuth2Grant;
  readonly scope?: string;
  readonly redactor: Redactor;
  readonly validator: SchemaValidator;
  /** Renew this many seconds before expiry, so a token never expires mid-request. */
  readonly refreshSkewSeconds?: number;
  readonly now?: () => number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

const tokenResponseSchema: ContractSchema<TokenResponse> = {
  type: 'object',
  properties: {
    access_token: { type: 'string', minLength: 1 },
    token_type: { type: 'string', minLength: 1 },
    expires_in: { type: 'integer', minimum: 1, nullable: true },
    scope: { type: 'string', nullable: true },
  },
  required: ['access_token', 'token_type'],
  additionalProperties: true,
};

const GRANT_NAMES = { password: 'password grant', client_credentials: 'client credentials grant' };

/**
 * OAuth 2.0 token authentication (RFC 6749 password and client-credentials grants). Tokens are
 * cached per strategy instance (one per scenario) and renewed shortly before expiry. Every token
 * is registered with the scenario redactor before use, so it is masked wherever it appears.
 */
export class OAuth2TokenAuth implements AuthStrategy {
  public readonly name = 'OAuth 2.0';
  private token: { value: string; expiresAt: number } | undefined;
  private pending: Promise<string> | undefined;

  public constructor(private readonly options: OAuth2TokenAuthOptions) {}

  public async headers(): Promise<Readonly<Record<string, string>>> {
    return { Authorization: `Bearer ${await this.accessToken()}` };
  }

  private accessToken(): Promise<string> {
    const now = (this.options.now ?? Date.now)();
    const skewMs = (this.options.refreshSkewSeconds ?? 30) * 1_000;
    if (this.token !== undefined && this.token.expiresAt - skewMs > now) {
      return Promise.resolve(this.token.value);
    }
    // Concurrent requests share one token request instead of racing for several tokens.
    this.pending ??= this.requestToken(now).finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async requestToken(now: number): Promise<string> {
    const grant = this.options.grant();
    const grantName = GRANT_NAMES[grant.type];
    const response = await this.options.tokenClient.post(this.options.tokenPath, {
      form: grantForm(grant, this.options.scope),
      anonymous: true,
      sensitive: true,
    });
    if (response.status !== 200) {
      throw new AuthenticationError(
        `The OAuth 2.0 ${grantName} was refused with HTTP ${response.status}${oauthErrorSuffix(response.body)}.`,
        {
          context: { grant: grant.type, status: response.status, error: oauthError(response.body) },
        },
      );
    }
    const issued = this.options.validator.validate(
      tokenResponseSchema,
      response.body,
      'OAuth 2.0 token response',
    );
    this.options.redactor.registerSensitiveValue(issued.access_token);
    if (issued.token_type.toLowerCase() !== 'bearer') {
      throw new AuthenticationError(
        `The token endpoint issued a "${issued.token_type}" token; only bearer tokens are supported.`,
        { context: { grant: grant.type } },
      );
    }
    this.token = {
      value: issued.access_token,
      expiresAt: issued.expires_in === undefined ? Infinity : now + issued.expires_in * 1_000,
    };
    return issued.access_token;
  }
}

function grantForm(grant: OAuth2Grant, scope: string | undefined): Record<string, string> {
  const client = {
    ...(grant.clientId === undefined ? {} : { client_id: grant.clientId.reveal() }),
    ...(grant.clientSecret === undefined ? {} : { client_secret: grant.clientSecret.reveal() }),
  };
  const common = { ...client, ...(scope === undefined ? {} : { scope }) };
  return grant.type === 'password'
    ? {
        grant_type: 'password',
        username: grant.username.reveal(),
        password: grant.password.reveal(),
        ...common,
      }
    : { grant_type: 'client_credentials', ...common };
}

/** The RFC 6749 `error` code (e.g. "invalid_grant"), which never contains credentials. */
function oauthError(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body;
    return typeof error === 'string' && /^[a-z_]{1,40}$/.test(error) ? error : undefined;
  }
  return undefined;
}

function oauthErrorSuffix(body: unknown): string {
  const error = oauthError(body);
  return error === undefined ? '' : ` (${error})`;
}
