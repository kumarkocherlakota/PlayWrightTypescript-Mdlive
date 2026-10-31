import type { DeepPartial } from './deep-partial';
import type { FrameworkConfig } from './config-schema';

export const DEFAULT_ENVIRONMENT = 'qa';

/**
 * Lowest-precedence configuration layer. Service URLs are intentionally absent: they must come
 * from the environment file or environment variables, so a run never targets an unintended host.
 */
export const CONFIG_DEFAULTS: DeepPartial<FrameworkConfig> = {
  project: {
    name: 'Universal Playwright Automation Framework',
    domain: 'healthcare',
  },
  ui: {
    browser: 'chromium',
    headless: true,
    slowMoMs: 0,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'UTC',
    testIdAttribute: 'data-testid',
    actionTimeoutMs: 10_000,
    navigationTimeoutMs: 30_000,
    expectTimeoutMs: 10_000,
  },
  api: {
    timeoutMs: 30_000,
    responseTimeThresholdMs: 2_000,
  },
  auth: {
    uiMethod: 'form',
    apiMethod: 'oauth2-password',
  },
  execution: {
    ci: false,
    workerId: 'main',
    stepTimeoutMs: 60_000,
  },
  artifacts: {
    outputDir: 'reports',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  logging: {
    level: 'info',
    console: false,
  },
  security: {
    authorizedHosts: [],
  },
  accessibility: {
    standard: 'wcag22aa',
    failOnImpact: 'serious',
  },
  referenceApp: {
    autoStart: false,
  },
  healthcare: {
    syntheticDataMarker: 'TEST-',
    fhir: { enabled: false, version: 'R4' },
  },
};
