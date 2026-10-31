import { ValidationError } from '@core/errors';
import type { InventoryItem, NewInventoryItem } from '../models/inventory-item';

const CLOCK_SKEW_MS = 5 * 60 * 1_000;

/**
 * Business check that the service stored what was requested: same values (names are trimmed by
 * the service), a synthetic-marked SKU, and a creation time close to now. Reports every
 * discrepancy at once. Contract shape is checked separately by the JSON Schema.
 */
export function assertStoredAsRequested(
  stored: InventoryItem,
  requested: NewInventoryItem,
  syntheticMarker: string,
  now: Date = new Date(),
): void {
  const problems: string[] = [];
  const expected = { ...requested, name: requested.name.trim() };
  for (const field of ['sku', 'name', 'category', 'quantity'] as const) {
    if (stored[field] !== expected[field]) {
      problems.push(
        `${field} was stored as "${String(stored[field])}" instead of "${String(expected[field])}"`,
      );
    }
  }
  if (!stored.sku.startsWith(syntheticMarker)) {
    problems.push(`sku does not carry the synthetic-data marker "${syntheticMarker}"`);
  }
  const ageMs = now.getTime() - Date.parse(stored.createdAt);
  if (Number.isNaN(ageMs) || Math.abs(ageMs) > CLOCK_SKEW_MS) {
    problems.push(`createdAt ${stored.createdAt} is not within 5 minutes of the request`);
  }
  if (problems.length > 0) {
    throw new ValidationError(
      `Inventory item ${stored.id} was not stored as requested: ${problems.join('; ')}.`,
      {
        context: { itemId: stored.id, problems },
      },
    );
  }
}
