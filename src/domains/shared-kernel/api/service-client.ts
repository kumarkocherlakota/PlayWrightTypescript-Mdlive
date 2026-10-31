import type { ApiSession, HttpClient } from '@interaction/api';

/**
 * HTTP client authenticated as the configured service client (OAuth 2.0 client credentials,
 * `API_CLIENT_ID` / `API_CLIENT_SECRET`). Used by role-based access scenarios: the service
 * client's role is whatever the identity provider grants that client, never assumed here.
 */
export function serviceClientOf(session: ApiSession): HttpClient {
  return session.clientWith(session.strategyFor('oauth2-client-credentials'));
}
