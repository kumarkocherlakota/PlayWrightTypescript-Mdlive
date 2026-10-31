import { devices, type BrowserContextOptions } from '@playwright/test';
import type { UiConfig } from '@core/config';
import { ConfigurationError } from '@core/errors';

/** Translates validated UI configuration into Playwright context options. */
export function buildContextOptions(
  ui: UiConfig,
  videoDirectory: string | undefined,
): BrowserContextOptions {
  const device = ui.device === undefined ? undefined : resolveDevice(ui.device);
  // The browser comes from configuration, not from the device descriptor.
  const { defaultBrowserType, ...deviceOptions } = device ?? {};

  return {
    ...(device === undefined ? { viewport: ui.viewport } : deviceOptions),
    baseURL: ui.baseUrl,
    locale: ui.locale,
    timezoneId: ui.timezoneId,
    acceptDownloads: false,
    serviceWorkers: 'block',
    ...(videoDirectory === undefined
      ? {}
      : { recordVideo: { dir: videoDirectory, size: device?.viewport ?? ui.viewport } }),
  };
}

function resolveDevice(name: string): (typeof devices)[string] {
  const descriptor = devices[name];
  if (descriptor === undefined) {
    throw new ConfigurationError(`Unknown device "${name}". Use a Playwright device name.`, {
      context: { device: name },
    });
  }
  return descriptor;
}
