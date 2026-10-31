import { ConfigurationError } from '@core/errors';
import type { PlainObject } from './deep-merge';
import type { EnvironmentSource } from './environment-source';
import type { ConfigVariableName } from './environment-variables';

/**
 * Maps environment variables onto the configuration shape. Values are converted to the right
 * primitive type here; enum and URL validation happens once, in the schema, after all layers
 * are merged.
 */
export function readEnvironmentOverrides(source: EnvironmentSource): PlainObject {
  const text = (name: ConfigVariableName): string | undefined => source.get(name);
  const bool = (name: ConfigVariableName): boolean | undefined => parseBoolean(name, text(name));
  const int = (name: ConfigVariableName): number | undefined => parseInteger(name, text(name));

  return {
    project: { name: text('PROJECT_NAME') },
    runId: text('TEST_RUN_ID'),
    ui: {
      baseUrl: text('UI_BASE_URL'),
      browser: text('BROWSER'),
      channel: text('BROWSER_CHANNEL'),
      device: text('DEVICE'),
      headless: bool('HEADLESS'),
      slowMoMs: int('SLOW_MO_MS'),
      locale: text('LOCALE'),
      timezoneId: text('TIMEZONE'),
    },
    api: { baseUrl: text('API_BASE_URL') },
    auth: { baseUrl: text('AUTH_BASE_URL'), apiMethod: text('API_AUTH_METHOD') },
    execution: {
      ci: bool('CI'),
      workerId: text('CUCUMBER_WORKER_ID'),
      stepTimeoutMs: int('STEP_TIMEOUT_MS'),
    },
    artifacts: {
      outputDir: text('ARTIFACTS_DIR'),
      screenshot: text('SCREENSHOT'),
      video: text('VIDEO'),
      trace: text('TRACE'),
    },
    logging: { level: text('LOG_LEVEL'), console: bool('LOG_TO_CONSOLE') },
    security: { authorizedHosts: parseList(text('SECURITY_AUTHORIZED_HOSTS')) },
    referenceApp: { autoStart: bool('REFERENCE_APP_AUTOSTART') },
  };
}

function parseBoolean(name: string, value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  throw new ConfigurationError(`Environment variable ${name} must be true/false or 1/0.`, {
    context: { variable: name },
  });
}

function parseInteger(name: string, value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^-?\d+$/.test(value)) {
    throw new ConfigurationError(`Environment variable ${name} must be an integer.`, {
      context: { variable: name },
    });
  }
  return Number(value);
}

function parseList(value: string | undefined): string[] | undefined {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}
