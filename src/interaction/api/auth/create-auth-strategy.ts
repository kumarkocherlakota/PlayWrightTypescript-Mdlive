import type { ApiAuthMethod, AuthConfig } from '@core/config';
import type { Redactor, Secret, SecretProvider } from '@core/security';
import type { HttpClient } from '../http-client';
import type { SchemaValidator } from '../schema-validator';
import { ApiKeyAuth } from './api-key-auth';
import { NoAuth, type AuthStrategy } from './auth-strategy';
import { OAuth2TokenAuth, type OAuth2Grant } from './oauth2-token-auth';

export interface AuthStrategyDependencies {
  readonly auth: AuthConfig;
  readonly secrets: SecretProvider;
  readonly tokenClient: HttpClient;
  readonly redactor: Redactor;
  readonly validator: SchemaValidator;
}

/** Builds the strategy selected by `auth.apiMethod`. Secrets are read on first use only. */
export function createAuthStrategy(
  method: ApiAuthMethod,
  dependencies: AuthStrategyDependencies,
): AuthStrategy {
  const { auth, secrets } = dependencies;
  switch (method) {
    case 'oauth2-password':
      return oauth2(dependencies, () =>
        passwordGrant(
          secrets.require('TEST_USER_EMAIL'),
          secrets.require('TEST_USER_PASSWORD'),
          secrets,
        ),
      );
    case 'oauth2-client-credentials':
      return oauth2(dependencies, () => ({
        type: 'client_credentials',
        clientId: secrets.require('API_CLIENT_ID'),
        clientSecret: secrets.require('API_CLIENT_SECRET'),
      }));
    case 'api-key':
      return new ApiKeyAuth(auth.apiKeyHeader, () => secrets.require('API_KEY'));
    case 'none':
      return new NoAuth();
  }
}

/** OAuth 2.0 password grant for explicit credentials, e.g. a deliberately wrong password. */
export function createPasswordGrantStrategy(
  username: Secret,
  password: Secret,
  dependencies: AuthStrategyDependencies,
): AuthStrategy {
  return oauth2(dependencies, () => passwordGrant(username, password, dependencies.secrets));
}

function oauth2(dependencies: AuthStrategyDependencies, grant: () => OAuth2Grant): AuthStrategy {
  const { auth, tokenClient, redactor, validator } = dependencies;
  return new OAuth2TokenAuth({
    tokenClient,
    tokenPath: auth.tokenPath,
    grant,
    redactor,
    validator,
    ...(auth.scope === undefined ? {} : { scope: auth.scope }),
  });
}

/** Public clients send only `client_id`; confidential clients also send `client_secret`. */
function passwordGrant(username: Secret, password: Secret, secrets: SecretProvider): OAuth2Grant {
  const clientId = secrets.find('API_CLIENT_ID');
  const clientSecret = secrets.find('API_CLIENT_SECRET');
  return {
    type: 'password',
    username,
    password,
    ...(clientId === undefined ? {} : { clientId }),
    ...(clientSecret === undefined ? {} : { clientSecret }),
  };
}
