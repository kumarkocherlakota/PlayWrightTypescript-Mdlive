import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { APIRequestContext } from '@playwright/test';
import { CONFIG_DEFAULTS, StaticEnvironmentSource, type AuthConfig } from '@core/config';
import { ConfigurationError } from '@core/errors';
import { EnvironmentSecretProvider, Redactor } from '@core/security';
import {
  createAuthStrategy,
  HttpClient,
  NoAuth,
  SchemaValidator,
  type AuthStrategyDependencies,
} from '@interaction/api';
import { createTestLogger } from './http-stub-server';

const AUTH: AuthConfig = {
  baseUrl: 'http://127.0.0.1:9/auth',
  uiMethod: 'form',
  apiMethod: 'oauth2-password',
  tokenPath: CONFIG_DEFAULTS.auth?.tokenPath ?? '/token',
  apiKeyHeader: 'X-API-Key',
};

/** Fails the test if a strategy ever sends a request; these tests stop before that point. */
const NO_NETWORK = new Proxy(
  {},
  {
    get: () => {
      throw new Error('Unexpected HTTP request in a unit test.');
    },
  },
);

function dependencies(variables: Record<string, string> = {}): AuthStrategyDependencies {
  const redactor = new Redactor();
  return {
    auth: AUTH,
    secrets: new EnvironmentSecretProvider(new StaticEnvironmentSource(variables), redactor),
    redactor,
    validator: new SchemaValidator(),
    tokenClient: new HttpClient({
      request: NO_NETWORK as APIRequestContext,
      baseUrl: AUTH.baseUrl,
      auth: new NoAuth(),
      logger: createTestLogger().logger,
      timeoutMs: 1_000,
      slowResponseMs: 1_000,
    }),
  };
}

describe('createAuthStrategy', () => {
  it('sends the API key in the configured header', async () => {
    const strategy = createAuthStrategy('api-key', dependencies({ API_KEY: 'synthetic-api-key' }));
    assert.deepEqual(await strategy.headers(), { 'X-API-Key': 'synthetic-api-key' });
  });

  it('sends no credentials for "none"', async () => {
    assert.deepEqual(await createAuthStrategy('none', dependencies()).headers(), {});
  });

  it('reads secrets only when the first request needs them', async () => {
    for (const method of ['oauth2-password', 'oauth2-client-credentials', 'api-key'] as const) {
      const strategy = createAuthStrategy(method, dependencies());
      await assert.rejects(strategy.headers(), ConfigurationError, `${method} should need secrets`);
    }
  });
});
