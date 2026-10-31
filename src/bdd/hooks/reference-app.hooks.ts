import { AfterAll, BeforeAll, HookTarget } from '@cucumber/cucumber';
import { getConfig, ProcessEnvironmentSource } from '@core/config';
import { FrameworkError } from '@core/errors';
import { EnvironmentSecretProvider, Redactor, type SecretProvider } from '@core/security';
import type { IdentityOptions } from '@reference-app/identity';
import { startReferenceApp, type ReferenceAppHandle } from '@reference-app/server';

/**
 * Starts the local synthetic reference app once per run (in the coordinator, before workers
 * start) when `referenceApp.autoStart` is enabled. Only the `local` environment enables it.
 */
let referenceApp: ReferenceAppHandle | undefined;

BeforeAll({ name: 'Start reference app', on: HookTarget.COORDINATOR }, async function () {
  const config = getConfig();
  if (!config.referenceApp.autoStart) {
    return;
  }
  const target = new URL(config.ui.baseUrl);
  const secrets = new EnvironmentSecretProvider(new ProcessEnvironmentSource(), new Redactor());
  try {
    referenceApp = await startReferenceApp({
      host: target.hostname,
      port: Number(target.port || 80),
      identity: identityFrom(secrets),
    });
  } catch (error) {
    throw new FrameworkError(
      `Could not start the reference app on ${target.host}. Stop the process using the port or set REFERENCE_APP_AUTOSTART=false.`,
      { cause: error, context: { host: target.host } },
    );
  }
});

AfterAll({ name: 'Stop reference app', on: HookTarget.COORDINATOR }, async function () {
  await referenceApp?.close();
  referenceApp = undefined;
});

/**
 * The synthetic identity provider accepts exactly the credentials configured for this run, so
 * no account exists in source control. Values are revealed only to hand them to that provider.
 */
function identityFrom(secrets: SecretProvider): IdentityOptions {
  const username = secrets.find('TEST_USER_EMAIL');
  const password = secrets.find('TEST_USER_PASSWORD');
  const clientId = secrets.find('API_CLIENT_ID');
  const clientSecret = secrets.find('API_CLIENT_SECRET');
  const apiKey = secrets.find('API_KEY');
  return {
    users:
      username && password ? [{ username: username.reveal(), password: password.reveal() }] : [],
    clients:
      clientId && clientSecret
        ? [{ clientId: clientId.reveal(), clientSecret: clientSecret.reveal() }]
        : [],
    apiKeys: apiKey ? [apiKey.reveal()] : [],
  };
}
