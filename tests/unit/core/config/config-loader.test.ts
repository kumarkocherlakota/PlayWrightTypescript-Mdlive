import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadConfig,
  StaticEnvironmentSource,
  type DeepPartial,
  type FrameworkConfig,
} from '@core/config';
import { ConfigurationError } from '@core/errors';

const QA_URLS = {
  UI_BASE_URL: 'https://ui.qa.example.test',
  API_BASE_URL: 'https://api.qa.example.test',
  AUTH_BASE_URL: 'https://auth.qa.example.test',
} as const;

describe('loadConfig', () => {
  it('defaults to the qa environment', () => {
    const config = loadConfig({ source: new StaticEnvironmentSource(QA_URLS) });
    assert.equal(config.environment, 'qa');
    assert.equal(config.ui.browser, 'chromium');
  });

  it('applies the environment file over defaults', () => {
    const config = loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'local' }) });
    assert.equal(config.ui.baseUrl, 'http://localhost:4000');
    assert.equal(config.logging.level, 'debug');
  });

  it('applies environment variables over the environment file', () => {
    const config = loadConfig({
      source: new StaticEnvironmentSource({
        TEST_ENV: 'local',
        UI_BASE_URL: 'http://127.0.0.1:5000',
        BROWSER: 'firefox',
        HEADLESS: 'false',
        SECURITY_AUTHORIZED_HOSTS: 'a.example.test, b.example.test',
      }),
    });
    assert.equal(config.ui.baseUrl, 'http://127.0.0.1:5000');
    assert.equal(config.ui.browser, 'firefox');
    assert.equal(config.ui.headless, false);
    assert.deepEqual(config.security.authorizedHosts, ['a.example.test', 'b.example.test']);
  });

  it('applies runtime overrides over environment variables', () => {
    const config = loadConfig({
      source: new StaticEnvironmentSource({ TEST_ENV: 'local', BROWSER: 'firefox' }),
      overrides: { ui: { browser: 'webkit' } },
    });
    assert.equal(config.ui.browser, 'webkit');
  });

  it('fails fast when qa URLs are missing', () => {
    assert.throws(
      () => loadConfig({ source: new StaticEnvironmentSource({}) }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message.includes('ui.baseUrl: is required (set UI_BASE_URL') &&
        error.message.includes('api.baseUrl: is required (set API_BASE_URL'),
    );
  });

  it('rejects an unsupported browser', () => {
    assert.throws(
      () =>
        loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'local', BROWSER: 'ie11' }) }),
      ConfigurationError,
    );
  });

  it('rejects malformed booleans and integers with the variable name', () => {
    assert.throws(
      () =>
        loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'local', HEADLESS: 'yes' }) }),
      /HEADLESS/,
    );
    assert.throws(
      () =>
        loadConfig({
          source: new StaticEnvironmentSource({ TEST_ENV: 'local', STEP_TIMEOUT_MS: '10s' }),
        }),
      /STEP_TIMEOUT_MS/,
    );
  });

  it('rejects non-http URLs and invalid time zones', () => {
    assert.throws(
      () =>
        loadConfig({
          source: new StaticEnvironmentSource({
            TEST_ENV: 'local',
            UI_BASE_URL: 'ftp://files.example.test',
            TIMEZONE: 'Mars/Olympus',
          }),
        }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message.includes('ui.baseUrl') &&
        error.message.includes('ui.timezoneId'),
    );
  });

  it('rejects unknown environments and lists the available ones', () => {
    assert.throws(
      () => loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'prod-like' }) }),
      /Unknown environment "prod-like"\. Available: .*qa/,
    );
  });

  it('rejects unknown keys so typos in environment files are caught', () => {
    assert.throws(
      () =>
        loadConfig({
          source: new StaticEnvironmentSource({ TEST_ENV: 'local' }),
          overrides: JSON.parse('{"ui":{"headles":true}}') as DeepPartial<FrameworkConfig>,
        }),
      /headles/,
    );
  });

  it('sets an appointment policy only where one is configured', () => {
    const local = loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'local' }) });
    assert.deepEqual(local.healthcare.appointmentPolicy, {
      bookingHorizonDays: 30,
      cancellationCutoffHours: 24,
      reasonForVisitMaxLength: 200,
    });
    const qa = loadConfig({ source: new StaticEnvironmentSource(QA_URLS) });
    assert.equal(qa.healthcare.appointmentPolicy, undefined);
  });

  it('rejects an appointment policy with impossible values', () => {
    assert.throws(
      () =>
        loadConfig({
          source: new StaticEnvironmentSource({ TEST_ENV: 'local' }),
          overrides: { healthcare: { appointmentPolicy: { bookingHorizonDays: 0 } } },
        }),
      /bookingHorizonDays/,
    );
  });

  it('returns a deeply frozen configuration', () => {
    const config = loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'local' }) });
    assert.ok(Object.isFrozen(config));
    assert.ok(Object.isFrozen(config.ui.viewport));
    assert.ok(Object.isFrozen(config.security.authorizedHosts));
  });
});
