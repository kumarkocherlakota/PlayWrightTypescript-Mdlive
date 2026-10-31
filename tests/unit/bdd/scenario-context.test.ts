import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FrameworkError } from '@core/errors';
import { ScenarioContext } from '@bdd/world/scenario-context';

interface TestState {
  'appointments.id': string;
  'appointments.count': number;
}

describe('ScenarioContext', () => {
  it('stores and returns typed values', () => {
    const context = new ScenarioContext<TestState>();
    context.set('appointments.id', 'A-1');
    context.set('appointments.count', 0);
    assert.equal(context.get('appointments.id'), 'A-1');
    assert.equal(context.get('appointments.count'), 0);
    assert.deepEqual(context.keys(), ['appointments.id', 'appointments.count']);
  });

  it('fails with the key name when a value was never stored', () => {
    const context = new ScenarioContext<TestState>();
    assert.throws(
      () => context.get('appointments.id'),
      (error: unknown) =>
        error instanceof FrameworkError && error.message.includes('appointments.id'),
    );
    assert.equal(context.find('appointments.id'), undefined);
  });

  it('keeps instances isolated', () => {
    const first = new ScenarioContext<TestState>();
    const second = new ScenarioContext<TestState>();
    first.set('appointments.id', 'A-1');
    assert.equal(second.has('appointments.id'), false);
  });
});
