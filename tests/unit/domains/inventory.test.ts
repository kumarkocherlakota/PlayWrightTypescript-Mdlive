import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TestDataError, ValidationError } from '@core/errors';
import { UniqueIdGenerator } from '@core/test-data';
import { InventoryItemBuilder } from '@domains/inventory/builders/inventory-item-builder';
import type { InventoryItem } from '@domains/inventory/models/inventory-item';
import { assertStoredAsRequested } from '@domains/inventory/validators/stored-item-validator';

const ids = () => new UniqueIdGenerator({ marker: 'TEST-', runId: 'unit', workerId: '0' });

describe('InventoryItemBuilder', () => {
  it('builds a valid, unique, marked item by default', () => {
    const builder = ids();
    const first = new InventoryItemBuilder(builder).build();
    const second = new InventoryItemBuilder(builder).build();
    assert.notEqual(first.sku, second.sku);
    assert.ok(first.sku.startsWith('TEST-ITEM-'));
    assert.deepEqual(
      { category: first.category, quantity: first.quantity },
      { category: 'Hardware', quantity: 10 },
    );
  });

  it('builds names of an exact length for boundary tests', () => {
    for (const length of [0, 1, 5, 6, 80, 81]) {
      const { name } = new InventoryItemBuilder(ids()).withNameOfLength(length).build();
      assert.equal(name.length, length);
    }
    assert.ok(
      new InventoryItemBuilder(ids()).withNameOfLength(80).build().name.startsWith('TEST-'),
    );
    assert.throws(() => new InventoryItemBuilder(ids()).withNameOfLength(-1), TestDataError);
  });
});

describe('assertStoredAsRequested', () => {
  const requested = new InventoryItemBuilder(ids()).withName('  TEST- widget ').build();
  const stored: InventoryItem = {
    ...requested,
    name: 'TEST- widget',
    id: '6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b',
    createdAt: new Date().toISOString(),
  };

  it('accepts an item stored as requested, allowing trimmed names', () => {
    assert.doesNotThrow(() => {
      assertStoredAsRequested(stored, requested, 'TEST-');
    });
  });

  it('reports every discrepancy at once', () => {
    assert.throws(
      () => {
        assertStoredAsRequested(
          { ...stored, quantity: 11, sku: 'REAL-1', createdAt: '2020-01-01T00:00:00.000Z' },
          { ...requested, sku: 'REAL-1' },
          'TEST-',
        );
      },
      (error: unknown) =>
        error instanceof ValidationError &&
        Array.isArray(error.context.problems) &&
        error.context.problems.length === 3,
    );
  });
});
