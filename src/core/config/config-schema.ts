import { z } from 'zod';

const httpUrl = (variable: string) =>
  z.url({
    protocol: /^https?$/,
    error: (issue) =>
      issue.input === undefined
        ? `is required (set ${variable} or define it in the environment file)`
        : 'must be an http(s) URL',
  });
const positiveMs = z.int().positive();
const headerName = z.string().regex(/^[A-Za-z0-9-]+$/, 'must be an HTTP header name');

export const BROWSER_NAMES = ['chromium', 'firefox', 'webkit'] as const;
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export const ARTIFACT_POLICIES = ['off', 'on', 'retain-on-failure'] as const;
export const SCREENSHOT_POLICIES = ['off', 'on', 'only-on-failure'] as const;
export const API_AUTH_METHODS = [
  'oauth2-password',
  'oauth2-client-credentials',
  'api-key',
  'none',
] as const;

const timeZone = z.string().refine(isValidTimeZone, { error: 'must be a valid IANA time zone' });

export const frameworkConfigSchema = z.strictObject({
  project: z.strictObject({
    name: z.string().min(1),
    domain: z.string().min(1),
  }),
  environment: z.string().regex(/^[a-z][a-z0-9-]*$/, 'must be a lowercase environment name'),
  runId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/, 'must be 1-64 safe characters'),
  ui: z.strictObject({
    baseUrl: httpUrl('UI_BASE_URL'),
    browser: z.enum(BROWSER_NAMES),
    channel: z.string().min(1).optional(),
    device: z.string().min(1).optional(),
    headless: z.boolean(),
    slowMoMs: z.int().min(0),
    viewport: z.strictObject({ width: z.int().min(320), height: z.int().min(320) }),
    locale: z.string().min(2),
    timezoneId: timeZone,
    testIdAttribute: z.string().min(1),
    actionTimeoutMs: positiveMs,
    navigationTimeoutMs: positiveMs,
    expectTimeoutMs: positiveMs,
  }),
  api: z.strictObject({
    baseUrl: httpUrl('API_BASE_URL'),
    timeoutMs: positiveMs,
    /** Responses slower than this are logged as warnings. */
    responseTimeThresholdMs: positiveMs,
    /** Header that carries the scenario correlation ID on every request. */
    correlationHeader: headerName,
  }),
  auth: z.strictObject({
    baseUrl: httpUrl('AUTH_BASE_URL'),
    uiMethod: z.enum(['form', 'sso', 'none']),
    apiMethod: z.enum(API_AUTH_METHODS),
    /** OAuth 2.0 token endpoint, relative to `auth.baseUrl`. */
    tokenPath: z.string().regex(/^\/[\w./-]*$/, 'must be a path starting with "/"'),
    /** Space-separated OAuth 2.0 scopes to request; omitted when not set. */
    scope: z.string().min(1).optional(),
    apiKeyHeader: headerName,
  }),
  execution: z.strictObject({
    ci: z.boolean(),
    workerId: z.string().min(1),
    stepTimeoutMs: positiveMs,
  }),
  artifacts: z.strictObject({
    outputDir: z.string().min(1),
    screenshot: z.enum(SCREENSHOT_POLICIES),
    video: z.enum(ARTIFACT_POLICIES),
    trace: z.enum(ARTIFACT_POLICIES),
    /** Traces and videos above this size stay on disk and are referenced by path only. */
    maxAttachmentMb: z.number().positive(),
  }),
  logging: z.strictObject({
    level: z.enum(LOG_LEVELS),
    console: z.boolean(),
  }),
  security: z.strictObject({
    authorizedHosts: z.array(z.string().min(1)),
    sessionTimeoutMinutes: z.int().positive().optional(),
  }),
  accessibility: z.strictObject({
    standard: z.enum(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']),
    failOnImpact: z.enum(['minor', 'moderate', 'serious', 'critical']),
  }),
  referenceApp: z.strictObject({
    /** Start the local synthetic reference app on the ui.baseUrl port before the run. */
    autoStart: z.boolean(),
  }),
  healthcare: z.strictObject({
    syntheticDataMarker: z.string().min(1),
    fhir: z.strictObject({
      enabled: z.boolean(),
      version: z.enum(['R4', 'R4B', 'R5']),
    }),
  }),
});

export type FrameworkConfig = z.infer<typeof frameworkConfigSchema>;
export type UiConfig = FrameworkConfig['ui'];
export type ApiConfig = FrameworkConfig['api'];
export type AuthConfig = FrameworkConfig['auth'];
export type ApiAuthMethod = AuthConfig['apiMethod'];
export type ArtifactsConfig = FrameworkConfig['artifacts'];
export type BrowserName = UiConfig['browser'];
export type LogLevel = FrameworkConfig['logging']['level'];
export type ArtifactPolicy = ArtifactsConfig['video'];
export type ScreenshotPolicy = ArtifactsConfig['screenshot'];

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
