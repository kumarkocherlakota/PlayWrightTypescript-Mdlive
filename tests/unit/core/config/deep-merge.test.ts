import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deepMerge } from '../../../../src/core/config/deep-merge';

describe('deepMerge', () => {
  it('merges nested objects with later layers winning', () => {
    assert.deepEqual(deepMerge({ a: { b: 1, c: 2 } }, { a: { c: 3 } }), { a: { b: 1, c: 3 } });
  });

  it('replaces arrays instead of concatenating them', () => {
    assert.deepEqual(deepMerge({ hosts: ['a', 'b'] }, { hosts: ['c'] }), { hosts: ['c'] });
  });

  it('never lets undefined overwrite a value', () => {
    assert.deepEqual(deepMerge({ a: 1 }, { a: undefined }), { a: 1 });
  });

  it('ignores non-object layers', () => {
    assert.deepEqual(deepMerge({ a: 1 }, undefined, null, 'text'), { a: 1 });
  });

  it('does not mutate its inputs', () => {
    const base = { a: { b: 1 } };
    deepMerge(base, { a: { b: 2 } });
    assert.equal(base.a.b, 1);
  });
});
