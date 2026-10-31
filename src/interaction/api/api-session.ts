import { request, type APIRequestContext } from '@playwright/test';
import type { ApiConfig, AuthConfig } from '@core/config';
import type { ExecutionLogger } from '@core/logging';
import type { Redactor, Secret, SecretProvider } from '@core/security';
import { NoAuth, type AuthStrategy } from './auth/auth-strategy';
import {
  createAuthStrategy,
  createPasswordGrantStrategy,
  type AuthStrategyDependencies,
} from './auth/create-auth-strategy';
import { HttpClient } from './http-client';
import type { HttpExchange } from './http-request';
import { SchemaValidator } from './schema-validator';

export interface ApiSessionOptions {
  readonly api: ApiConfig;
  readonly auth: AuthConfig;
  readonly logger: ExecutionLogger;
  readonly redactor: Redactor;
  readonly secrets: SecretProvider;
  /** Sent on every request in `api.correlationHeader`, so server logs can be matched to a scenario. */
  readonly correlationId: string;
  /** Share one validator per worker so compiled schemas are reused across scenarios. */
  readonly validator?: SchemaValidator;
}

const MAX_RECORDED_EXCHANGES = 100;

/**
 * One isolated HTTP session per scenario (ADR-004): its own APIRequestContext (cookies included),
 * its own token cache, and a summary of every exchange for failure reports. API-only scenarios
 * use this instead of a browser.
 */
export class ApiSession {
  public readonly validator: SchemaValidator;
  private readonly recorded: HttpExchange[] = [];
  private readonly authDependencies: AuthStrategyDependencies;
  private defaultClient: HttpClient | undefined;

  private constructor(
    private readonly context: APIRequestContext,
    private readonly options: ApiSessionOptions,
  ) {
    this.validator = options.validator ?? new SchemaValidator();
    this.authDependencies = {
      auth: options.auth,
      secrets: options.secrets,
      redactor: options.redactor,
      validator: this.validator,
      tokenClient: this.createClient(options.auth.baseUrl, new NoAuth(), 'auth'),
    };
  }

  public static async open(options: ApiSessionOptions): Promise<ApiSession> {
    const context = await request.newContext({
      timeout: options.api.timeoutMs,
      extraHTTPHeaders: { [options.api.correlationHeader]: options.correlationId },
    });
    return new ApiSession(context, options);
  }

  /** Client for `api.baseUrl` authenticated with the configured `auth.apiMethod`. */
  public client(): HttpClient {
    this.defaultClient ??= this.clientWith(
      createAuthStrategy(this.options.auth.apiMethod, this.authDependencies),
    );
    return this.defaultClient;
  }

  /** Client for `api.baseUrl` with an explicit strategy, e.g. for negative security tests. */
  public clientWith(auth: AuthStrategy): HttpClient {
    return this.createClient(this.options.api.baseUrl, auth, 'api');
  }

  /** OAuth 2.0 password-grant strategy for explicit (usually deliberately invalid) credentials. */
  public passwordGrant(username: Secret, password: Secret): AuthStrategy {
    return createPasswordGrantStrategy(username, password, this.authDependencies);
  }

  public exchanges(): readonly HttpExchange[] {
    return [...this.recorded];
  }

  public async close(): Promise<void> {
    await this.context.dispose();
  }

  private createClient(baseUrl: string, auth: AuthStrategy, component: string): HttpClient {
    return new HttpClient({
      request: this.context,
      baseUrl,
      auth,
      logger: this.options.logger.child({ component }),
      timeoutMs: this.options.api.timeoutMs,
      slowResponseMs: this.options.api.responseTimeThresholdMs,
      onExchange: (exchange) => {
        if (this.recorded.length < MAX_RECORDED_EXCHANGES) {
          this.recorded.push(exchange);
        }
      },
    });
  }
}
