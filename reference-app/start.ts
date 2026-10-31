/**
 * Starts the synthetic reference app for manual exploration:
 *   npm run reference-app            (http://localhost:4000)
 *   npm run reference-app -- 4100    (custom port)
 * The identity provider accepts the same variables the framework uses (TEST_USER_EMAIL,
 * TEST_USER_PASSWORD, API_CLIENT_ID, API_CLIENT_SECRET, API_KEY); unset ones are not accepted.
 */
import type { IdentityOptions } from './identity';
import { startReferenceApp } from './server';

const port = Number(process.argv[2] ?? 4000);
const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
};

function identityFromEnvironment(): IdentityOptions {
  const [username, password] = [env('TEST_USER_EMAIL'), env('TEST_USER_PASSWORD')];
  const [clientId, clientSecret] = [env('API_CLIENT_ID'), env('API_CLIENT_SECRET')];
  const apiKey = env('API_KEY');
  return {
    users: username && password ? [{ username, password }] : [],
    clients: clientId && clientSecret ? [{ clientId, clientSecret }] : [],
    apiKeys: apiKey ? [apiKey] : [],
  };
}

startReferenceApp({ host: 'localhost', port, identity: identityFromEnvironment() }).then(
  (app) => {
    console.log(
      `Synthetic reference app running at ${app.url}/gallery and ${app.url}/portal (Ctrl+C to stop)`,
    );
  },
  (error: unknown) => {
    console.error('Failed to start the reference app:', error);
    process.exitCode = 1;
  },
);
