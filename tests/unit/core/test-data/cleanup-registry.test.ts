import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TestDataError } from '@core/errors';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { Redactor } from '@core/security';
import { CleanupRegistry } from '@core/test-data';

function registry() {
  const logs = new MemoryLogSink();
  const logger = new ExecutionLogger({ level: 'debug', redactor: new Redactor(), sinks: [logs] });
  return { cleanup: new CleanupRegistry(logger), logs };
}

describe('CleanupRegistry', () => {
  it('runs actions in reverse registration order and then forgets them', async () => {
    const { cleanup } = registry();
    const order: string[] = [];
    for (const name of ['parent', 'child']) {
      cleanup.register(`delete ${name}`, () => {
        order.push(name);
        return Promise.resolve();
      });
    }
    const report = await cleanup.runAll();
    assert.deepEqual(order, ['child', 'parent']);
    assert.deepEqual(report, { succeeded: ['delete child', 'delete parent'], failed: [] });
    assert.equal(cleanup.size, 0);
    assert.deepEqual(await cleanup.runAll(), { succeeded: [], failed: [] });
  });

  it('keeps running after a failure and logs it at error level', async () => {
    const { cleanup, logs } = registry();
    let laterRan = false;
    cleanup.register('delete later', () => {
      laterRan = true;
      return Promise.resolve();
    });
    cleanup.register('delete broken', () => Promise.reject(new Error('HTTP 503')));
    const report = await cleanup.runAll();
    assert.equal(laterRan, true);
    assert.deepEqual(report.succeeded, ['delete later']);
    assert.equal(report.failed[0]?.description, 'delete broken');
    assert.equal(report.failed[0].error.message, 'HTTP 503');
    assert.ok(
      logs
        .entries()
        .some(
          (entry) => entry.level === 'error' && entry.message === 'Cleanup failed: delete broken',
        ),
    );
  });

  it('throws a TestDataError naming every failed action from runAllOrThrow', async () => {
    const { cleanup } = registry();
    cleanup.register('delete a', () => Promise.reject(new Error('gone')));
    cleanup.register('delete b', () => Promise.reject(new Error('gone')));
    await assert.rejects(
      cleanup.runAllOrThrow(),
      (error: unknown) =>
        error instanceof TestDataError &&
        error.message.startsWith('Test-data cleanup failed for 2 action(s): delete b; delete a.'),
    );
  });
});
