import type { IdentityProvider } from '../identity';
import { readFormBody, sendJson, type Route } from '../routing';

/** OAuth 2.0 token endpoint (RFC 6749 section 5) supporting password and client-credentials grants. */
export function authRoutes(identity: IdentityProvider): readonly Route[] {
  return [
    {
      method: 'POST',
      path: '/auth/token',
      handle: async (request, response) => {
        const form = await readFormBody(request);
        const grantType = form.get('grant_type');
        const noStore = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

        if (grantType === 'password') {
          const username = form.get('username');
          const password = form.get('password');
          if (username === null || password === null) {
            sendJson(response, 400, { error: 'invalid_request' }, noStore);
            return;
          }
          const token = identity.passwordGrant(username, password);
          sendJson(response, token ? 200 : 400, token ?? { error: 'invalid_grant' }, noStore);
          return;
        }

        if (grantType === 'client_credentials') {
          const clientId = form.get('client_id');
          const clientSecret = form.get('client_secret');
          if (clientId === null || clientSecret === null) {
            sendJson(response, 400, { error: 'invalid_request' }, noStore);
            return;
          }
          const token = identity.clientCredentialsGrant(clientId, clientSecret);
          sendJson(response, token ? 200 : 401, token ?? { error: 'invalid_client' }, noStore);
          return;
        }

        sendJson(response, 400, { error: 'unsupported_grant_type' }, noStore);
      },
    },
  ];
}
