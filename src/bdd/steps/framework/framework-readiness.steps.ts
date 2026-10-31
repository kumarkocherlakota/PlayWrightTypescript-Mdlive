import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { FrameworkError } from '@core/errors';
import { MASK } from '@core/security';
import { syntheticSensitiveValue, type SensitiveValueType } from '@core/test-data';
import { sensitiveLogProbe } from '@bdd/support/sensitive-log-probes';
import type { CustomWorld } from '@bdd/world/custom-world';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'framework.sensitiveValue': string;
    'framework.neverStored': string;
    'framework.stateReadOutcome': { readonly thrown: boolean; readonly error?: unknown };
  }
}

Then('the active configuration cannot be modified during the run', function (this: CustomWorld) {
  expect(Object.isFrozen(this.config)).toBe(true);
  expect(Object.isFrozen(this.config.ui)).toBe(true);
  expect(Reflect.set(this.config, 'environment', 'tampered')).toBe(false);
});

Then('every configured service URL uses HTTP or HTTPS', function (this: CustomWorld) {
  const { ui, api, auth } = this.config;
  for (const url of [ui.baseUrl, api.baseUrl, auth.baseUrl]) {
    expect(new URL(url).protocol).toMatch(/^https?:$/);
  }
});

Given(
  'a synthetic {sensitiveValueType} is written to the execution log',
  function (this: CustomWorld, type: SensitiveValueType) {
    const value = syntheticSensitiveValue(type);
    this.state.set('framework.sensitiveValue', value);
    const probe = sensitiveLogProbe(type, value);
    this.logger.info(probe.message, probe.data);
  },
);

Then('the execution log does not reveal the synthetic value', function (this: CustomWorld) {
  expect(this.logBuffer.toJsonLines()).not.toContain(this.state.get('framework.sensitiveValue'));
});

Then('the execution log shows the value as masked', function (this: CustomWorld) {
  expect(this.logBuffer.toJsonLines()).toContain(MASK);
});

When('the scenario reads state that was never stored', function (this: CustomWorld) {
  try {
    this.state.get('framework.neverStored');
    this.state.set('framework.stateReadOutcome', { thrown: false });
  } catch (error) {
    this.state.set('framework.stateReadOutcome', { thrown: true, error });
  }
});

Then('the framework reports which scenario state is missing', function (this: CustomWorld) {
  const outcome = this.state.get('framework.stateReadOutcome');
  expect(outcome.thrown).toBe(true);
  expect(outcome.error).toBeInstanceOf(FrameworkError);
  expect(String(outcome.error)).toContain('framework.neverStored');
});

Then(
  'the browser session starts without cookies or stored data',
  async function (this: CustomWorld) {
    const storage = await this.ui.storageSummary();
    expect(storage.cookies).toBe(0);
    expect(storage.originsWithStorage).toBe(0);
    expect(storage.url).toBe('about:blank');
  },
);
