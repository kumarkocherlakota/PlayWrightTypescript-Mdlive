import type { IncomingMessage, ServerResponse } from 'node:http';
import { PORTAL_SESSION_COOKIE, type IdentityProvider, type Principal } from './identity';
import { readCookie, sendJson } from './routing';

/**
 * Resolves the caller from a bearer token, an API key or a patient-portal session cookie and
 * checks one scope. Sends 401/403 and returns undefined when the caller may not proceed.
 *
 * Cookie-authenticated writes are refused for cross-site requests (on top of SameSite=Strict),
 * so another site cannot book or cancel on a member's behalf.
 */
export function authorize(
  identity: IdentityProvider,
  request: IncomingMessage,
  response: ServerResponse,
  scope: string,
): Principal | undefined {
  const principal = resolvePrincipal(identity, request);
  if (principal === undefined) {
    sendJson(response, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
    return undefined;
  }
  if (!principal.scopes.includes(scope)) {
    sendJson(
      response,
      403,
      { error: 'insufficient_scope', scope },
      { 'WWW-Authenticate': `Bearer error="insufficient_scope", scope="${scope}"` },
    );
    return undefined;
  }
  return principal;
}

function resolvePrincipal(
  identity: IdentityProvider,
  request: IncomingMessage,
): Principal | undefined {
  const apiKey = request.headers['x-api-key'];
  if (request.headers.authorization !== undefined || apiKey !== undefined) {
    return identity.authenticate(
      request.headers.authorization,
      typeof apiKey === 'string' ? apiKey : undefined,
    );
  }
  const isWrite = request.method !== 'GET' && request.method !== 'HEAD';
  if (isWrite && request.headers['sec-fetch-site'] === 'cross-site') {
    return undefined;
  }
  return identity.portalPrincipal(readCookie(request, PORTAL_SESSION_COOKIE));
}
