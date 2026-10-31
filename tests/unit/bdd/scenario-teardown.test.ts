import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FrameworkError } from '@core/errors';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { Redactor } from '@core/security';
import { findCredentialLeaks } from '@bdd/support/credential-leak-probe';
import { runTeardown } from '@bdd/support/scenario-teardown';

function logger() {
  const logs = new MemoryLogSink();
  return {
    logs,
    logger: new ExecutionLogger({ level: 'debug', redactor: new Redactor(), sinks: [logs] }),
  };
}

describe('runTeardown', () => {
  it('runs every step even after a failure and rethrows a single failure unchanged', async () => {
    const { logger: log, logs } = logger();
    const failure = new Error('cleanup failed');
    const ran: string[] = [];
    await assert.rejects(
      runTeardown(
        [
          { name: 'cleanup', run: () => Promise.reject(failure) },
          { name: 'ui', run: () => Promise.resolve(void ran.push('ui')) },
        ],
        log,
      ),
      failure,
    );
    assert.deepEqual(ran, ['ui']);
    assert.ok(
      logs
        .entries()
        .some(
          (entry) => entry.level === 'error' && entry.message === 'Teardown step failed: cleanup',
        ),
    );
  });

  it('aggregates several failures into one FrameworkError', async () => {
    await assert.rejects(
      runTeardown(
        [
          { name: 'cleanup', run: () => Promise.reject(new Error('a')) },
          { name: 'api', run: () => Promise.reject(new Error('b')) },
        ],
        logger().logger,
      ),
      (error: unknown) =>
        error instanceof FrameworkError &&
        error.message === '2 teardown steps failed: cleanup, api.' &&
        error.cause instanceof AggregateError &&
        error.cause.errors.length === 2,
    );
  });
});

describe('findCredentialLeaks', () => {
  it('finds unmasked tokens, authorization values and credential form fields', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.c2lnbmF0dXJl';
    assert.deepEqual(findCredentialLeaks(`token ${jwt}`), ['JWT']);
    assert.deepEqual(findCredentialLeaks('Authorization: Bearer abcdefgh12345'), [
      'authorization value',
    ]);
    assert.deepEqual(findCredentialLeaks('body grant_type=password&password=Syn-123'), [
      'credential form field',
    ]);
  });

  it('accepts masked values', () => {
    assert.deepEqual(findCredentialLeaks('Bearer *** password=*** access_token=***'), []);
  });
});
