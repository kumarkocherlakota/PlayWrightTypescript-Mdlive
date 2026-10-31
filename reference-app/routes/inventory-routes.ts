import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authorize as authorizeCaller } from '../authorization';
import type { IdentityProvider } from '../identity';
import { readJsonBody, sendEmpty, sendJson, type Route } from '../routing';

/**
 * Synthetic inventory API used by the framework's API self-tests. Not healthcare data.
 * The rules below are fixture rules chosen to exercise positive, negative and boundary cases;
 * they describe no real system.
 */
export const INVENTORY_RULES = {
  categories: ['Hardware', 'Software', 'Services'],
  name: { min: 1, max: 80 },
  quantity: { min: 0, max: 10_000 },
  sku: /^[A-Za-z0-9-]{3,64}$/,
  limit: { min: 1, max: 100, default: 20 },
} as const;

const FIELDS = ['sku', 'name', 'category', 'quantity'] as const;

interface InventoryItem {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly quantity: number;
  readonly createdAt: string;
}

interface FieldError {
  readonly field: string;
  readonly message: string;
}

export function inventoryRoutes(identity: IdentityProvider): readonly Route[] {
  const items = new Map<string, InventoryItem>();
  const base = '/api/inventory/items';

  const authorize = (request: IncomingMessage, response: ServerResponse, scope: string) =>
    authorizeCaller(identity, request, response, scope) !== undefined;

  return [
    {
      method: 'GET',
      path: base,
      handle: (request, response, url) => {
        if (!authorize(request, response, 'inventory:read')) {
          return;
        }
        const limit = parseLimit(url.searchParams.get('limit'));
        if (limit === undefined) {
          const { min, max } = INVENTORY_RULES.limit;
          sendJson(
            response,
            400,
            validationFailed([
              { field: 'limit', message: `must be an integer from ${min} to ${max}` },
            ]),
          );
          return;
        }
        const prefix = url.searchParams.get('skuPrefix') ?? '';
        const matching = [...items.values()].filter((item) => item.sku.startsWith(prefix));
        sendJson(response, 200, { items: matching.slice(0, limit), total: matching.length, limit });
      },
    },
    {
      method: 'POST',
      path: base,
      handle: async (request, response) => {
        if (!authorize(request, response, 'inventory:write')) {
          return;
        }
        const body = await readJsonBody(request);
        const errors = validateNewItem(body);
        if (errors.length > 0 || !isRecord(body)) {
          sendJson(response, 400, validationFailed(errors));
          return;
        }
        const sku = String(body.sku);
        if ([...items.values()].some((item) => item.sku === sku)) {
          sendJson(response, 409, { error: 'duplicate_sku' });
          return;
        }
        const item: InventoryItem = {
          id: randomUUID(),
          sku,
          name: String(body.name).trim(),
          category: String(body.category),
          quantity: Number(body.quantity),
          createdAt: new Date().toISOString(),
        };
        items.set(item.id, item);
        sendJson(response, 201, item, { Location: `${base}/${item.id}` });
      },
    },
    {
      method: 'GET',
      path: `${base}/:id`,
      handle: (request, response, _url, params) => {
        if (!authorize(request, response, 'inventory:read')) {
          return;
        }
        const item = items.get(params.id ?? '');
        if (item === undefined) {
          sendJson(response, 404, { error: 'not_found' });
          return;
        }
        sendJson(response, 200, item);
      },
    },
    {
      method: 'DELETE',
      path: `${base}/:id`,
      handle: (request, response, _url, params) => {
        if (!authorize(request, response, 'inventory:write')) {
          return;
        }
        if (!items.delete(params.id ?? '')) {
          sendJson(response, 404, { error: 'not_found' });
          return;
        }
        sendEmpty(response, 204);
      },
    },
  ];
}

function validateNewItem(body: unknown): FieldError[] {
  if (!isRecord(body)) {
    return [{ field: '', message: 'must be a JSON object' }];
  }
  const errors: FieldError[] = Object.keys(body)
    .filter((key) => !(FIELDS as readonly string[]).includes(key))
    .map((field) => ({ field, message: 'is not a recognized field' }));
  const { sku, name, category, quantity } = body;
  if (typeof sku !== 'string' || !INVENTORY_RULES.sku.test(sku)) {
    errors.push({ field: 'sku', message: 'must be 3-64 letters, digits or hyphens' });
  }
  const nameLength = typeof name === 'string' ? name.trim().length : -1;
  if (nameLength < INVENTORY_RULES.name.min || nameLength > INVENTORY_RULES.name.max) {
    errors.push({
      field: 'name',
      message: `must be ${INVENTORY_RULES.name.min}-${INVENTORY_RULES.name.max} characters`,
    });
  }
  if (
    typeof category !== 'string' ||
    !(INVENTORY_RULES.categories as readonly string[]).includes(category)
  ) {
    errors.push({
      field: 'category',
      message: `must be one of ${INVENTORY_RULES.categories.join(', ')}`,
    });
  }
  const { min, max } = INVENTORY_RULES.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < min ||
    quantity > max
  ) {
    errors.push({ field: 'quantity', message: `must be an integer from ${min} to ${max}` });
  }
  return errors;
}

function parseLimit(value: string | null): number | undefined {
  if (value === null) {
    return INVENTORY_RULES.limit.default;
  }
  const limit = /^\d+$/.test(value) ? Number(value) : NaN;
  return limit >= INVENTORY_RULES.limit.min && limit <= INVENTORY_RULES.limit.max
    ? limit
    : undefined;
}

function validationFailed(details: readonly FieldError[]): Record<string, unknown> {
  return { error: 'validation_failed', details };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
