import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TestDataError } from '@core/errors';
import { UniqueIdGenerator } from '@core/test-data';

const options = { marker: 'TEST-', runId: '20261031T091500-ab12cd', workerId: '2' };

describe('UniqueIdGenerator', () => {
  it('builds marked, labelled identifiers with an increasing sequence', () => {
    const ids = new UniqueIdGenerator(options);
    const first = ids.next('ITEM');
    const second = ids.next('ITEM');
    assert.match(first, /^TEST-ITEM-[0-9a-f]{6}-w2-1$/);
    assert.match(second, /^TEST-ITEM-[0-9a-f]{6}-w2-2$/);
    assert.equal(ids.marker, 'TEST-');
  });

  it('differs between workers and between runs', () => {
    const worker2 = new UniqueIdGenerator(options).next('ITEM');
    const worker3 = new UniqueIdGenerator({ ...options, workerId: '3' }).next('ITEM');
    const otherRun = new UniqueIdGenerator({ ...options, runId: 'ci-run-7' }).next('ITEM');
    assert.equal(new Set([worker2, worker3, otherRun]).size, 3);
  });

  it('keeps identifiers short even for long run IDs', () => {
    const ids = new UniqueIdGenerator({ ...options, runId: 'r'.repeat(64), workerId: 'main' });
    assert.ok(ids.next('ITEM').length <= 30);
  });

  it('rejects labels that would make identifiers ambiguous', () => {
    const ids = new UniqueIdGenerator(options);
    for (const label of ['item', '', '1ITEM', 'ITEM-X', 'A'.repeat(17)]) {
      assert.throws(() => ids.next(label), TestDataError, label);
    }
  });
});
