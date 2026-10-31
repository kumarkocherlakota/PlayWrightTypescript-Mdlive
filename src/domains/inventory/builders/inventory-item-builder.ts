import { TestDataError } from '@core/errors';
import type { UniqueIdGenerator } from '@core/test-data';
import type { InventoryCategory, NewInventoryItem } from '../models/inventory-item';

/**
 * Builds synthetic inventory items that are valid by default and unique per scenario (ADR-006).
 * The SKU always carries the synthetic-data marker; tests change only what they are about.
 */
export class InventoryItemBuilder {
  private item: NewInventoryItem;

  public constructor(private readonly ids: UniqueIdGenerator) {
    const sku = ids.next('ITEM');
    this.item = { sku, name: `${sku} synthetic item`, category: 'Hardware', quantity: 10 };
  }

  public withName(name: string): this {
    this.item = { ...this.item, name };
    return this;
  }

  /**
   * A name of exactly `length` characters, for boundary tests. Starts with the synthetic marker
   * when there is room for it.
   */
  public withNameOfLength(length: number): this {
    if (!Number.isInteger(length) || length < 0) {
      throw new TestDataError(`Name length must be a non-negative integer, got ${length}.`);
    }
    const marker = this.ids.marker;
    const name = length > marker.length ? marker.padEnd(length, 'n') : 'n'.repeat(length);
    return this.withName(name);
  }

  public withCategory(category: InventoryCategory): this {
    this.item = { ...this.item, category };
    return this;
  }

  public withQuantity(quantity: number): this {
    this.item = { ...this.item, quantity };
    return this;
  }

  /** Reuses the SKU of an existing item, for duplicate-detection tests. */
  public withSku(sku: string): this {
    this.item = { ...this.item, sku };
    return this;
  }

  public build(): NewInventoryItem {
    return { ...this.item };
  }

  /**
   * A payload that may break the API contract on purpose (unknown fields, wrong types), for
   * negative tests. Prefer `build()` whenever the payload is meant to be valid.
   */
  public buildPayloadWith(changes: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return { ...this.item, ...changes };
  }
}
