/**
 * Allowlist of environment variables the framework may read. Reading anything else is a type
 * error, which keeps the configuration surface explicit and documented in .env.example.
 */
export const CONFIG_VARIABLES = [
  'TEST_ENV',
  'CONFIG_DIR',
  'PROJECT_NAME',
  'UI_BASE_URL',
  'API_BASE_URL',
  'AUTH_BASE_URL',
  'API_AUTH_METHOD',
  'BROWSER',
  'BROWSER_CHANNEL',
  'DEVICE',
  'HEADLESS',
  'SLOW_MO_MS',
  'LOCALE',
  'TIMEZONE',
  'LOG_LEVEL',
  'LOG_TO_CONSOLE',
  'STEP_TIMEOUT_MS',
  'TRACE',
  'VIDEO',
  'SCREENSHOT',
  'ARTIFACTS_DIR',
  'SECURITY_AUTHORIZED_HOSTS',
  'REFERENCE_APP_AUTOSTART',
  'TEST_RUN_ID',
  'CI',
  'CUCUMBER_WORKER_ID',
] as const;

export const SECRET_VARIABLES = [
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'API_CLIENT_ID',
  'API_CLIENT_SECRET',
  'API_KEY',
] as const;

export type ConfigVariableName = (typeof CONFIG_VARIABLES)[number];
export type SecretName = (typeof SECRET_VARIABLES)[number];
export type EnvironmentVariableName = ConfigVariableName | SecretName;
