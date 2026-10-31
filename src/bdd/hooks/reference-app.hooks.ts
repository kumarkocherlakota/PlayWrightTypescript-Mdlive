import { AfterAll, BeforeAll, HookTarget } from '@cucumber/cucumber';
import { getConfig } from '@core/config';
import { FrameworkError } from '@core/errors';
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
  try {
    referenceApp = await startReferenceApp({
      host: target.hostname,
      port: Number(target.port || 80),
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
