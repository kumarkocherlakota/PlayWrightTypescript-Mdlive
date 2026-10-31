import type { ContractSchema } from '@interaction/api';
import { INVENTORY_CATEGORIES, type InventoryCategory } from '../models/inventory-item';

/**
 * Response contracts of the synthetic inventory API. `ContractSchema<T>` makes TypeScript reject
 * a schema that does not describe `T`, so the models and the contracts cannot drift apart.
 * Mutable mirror types are needed because Ajv's schema typing does not accept readonly members.
 */
interface ItemContract {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  createdAt: string;
}

interface ListContract {
  items: ItemContract[];
  total: number;
  limit: number;
}

interface ErrorContract {
  error: string;
  details?: { field: string; message: string }[];
}

export const inventoryItemSchema: ContractSchema<ItemContract> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    sku: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    category: { type: 'string', enum: [...INVENTORY_CATEGORIES] },
    quantity: { type: 'integer', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'sku', 'name', 'category', 'quantity', 'createdAt'],
  additionalProperties: false,
};

export const inventoryListSchema: ContractSchema<ListContract> = {
  type: 'object',
  properties: {
    items: { type: 'array', items: inventoryItemSchema },
    total: { type: 'integer', minimum: 0 },
    limit: { type: 'integer', minimum: 1 },
  },
  required: ['items', 'total', 'limit'],
  additionalProperties: false,
};

export const apiErrorSchema: ContractSchema<ErrorContract> = {
  type: 'object',
  properties: {
    error: { type: 'string', minLength: 1 },
    details: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: { field: { type: 'string' }, message: { type: 'string' } },
        required: ['field', 'message'],
        additionalProperties: false,
      },
    },
  },
  required: ['error'],
  additionalProperties: true,
};
