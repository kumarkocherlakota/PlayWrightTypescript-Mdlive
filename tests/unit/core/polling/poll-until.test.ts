import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '@core/errors';
import { pollUntil } from '@core/polling';

function counter() {
  let calls = 0;
  return {
    next: () => {
      calls += 1;
      return Promise.resolve(calls);
    },
    calls: () => calls,
  };
}

describe('pollUntil', () => {
  it('returns as soon as the condition is met', async () => {
    const source = counter();
    const result = await pollUntil(source.next, (value) => value >= 3, {
      description: 'third call',
      timeoutMs: 2_000,
      intervalMs: 1,
    });
    assert.equal(result.value, 3);
    assert.equal(result.attempts, 3);
  });

  it('times out with the last observed value as evidence', async () => {
    await assert.rejects(
      pollUntil(
        () => Promise.resolve('PENDING'),
        (value) => value === 'CONFIRMED',
        {
          description: 'appointment confirmation',
          timeoutMs: 30,
          intervalMs: 5,
        },
      ),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.message.includes('appointment confirmation') &&
        error.context.lastValue === 'PENDING',
    );
  });

  it('fails immediately on probe errors that are not retryable', async () => {
    const failure = new Error('HTTP 500');
    let calls = 0;
    await assert.rejects(
      pollUntil(
        () => {
          calls += 1;
          return Promise.reject(failure);
        },
        () => true,
        { description: 'record', timeoutMs: 1_000, intervalMs: 1 },
      ),
      failure,
    );
    assert.equal(calls, 1);
  });

  it('retries probe errors accepted by retryOn and reports the last error on timeout', async () => {
    await assert.rejects(
      pollUntil(
        () => Promise.reject(new Error('404 not yet visible')),
        () => true,
        { description: 'record', timeoutMs: 30, intervalMs: 5, retryOn: () => true },
      ),
      (error: unknown) =>
        error instanceof ValidationError &&
        JSON.stringify(error.context.lastError).includes('404 not yet visible'),
    );
  });
});
