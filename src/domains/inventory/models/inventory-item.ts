export const INVENTORY_CATEGORIES = ['Hardware', 'Software', 'Services'] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

/** What a client submits to stock a new item. */
export interface NewInventoryItem {
  readonly sku: string;
  readonly name: string;
  readonly category: InventoryCategory;
  readonly quantity: number;
}

/** An item as stored by the inventory service. */
export interface InventoryItem extends NewInventoryItem {
  readonly id: string;
  /** ISO 8601 timestamp set by the service. */
  readonly createdAt: string;
}

export interface InventoryList {
  readonly items: readonly InventoryItem[];
  /** Number of matching items before `limit` was applied. */
  readonly total: number;
  readonly limit: number;
}

export interface ListCriteria {
  readonly skuPrefix?: string;
  readonly limit?: number;
}

/** Result of a request that may legitimately be rejected (negative and boundary tests). */
export type RequestOutcome<T> =
  | { readonly accepted: true; readonly status: number; readonly value: T }
  | {
      readonly accepted: false;
      readonly status: number;
      /** Machine-readable error code from the service, e.g. "validation_failed". */
      readonly error: string;
      /** Fields the service reported as invalid; empty when the error is not field-specific. */
      readonly invalidFields: readonly string[];
    };

export const ACCESS_METHODS = [
  'no credentials',
  'an invalid token',
  'unknown credentials',
] as const;
export type AccessMethod = (typeof ACCESS_METHODS)[number];

/** How the service treated a request made with a particular kind of credentials. */
export interface AccessAttempt {
  readonly granted: boolean;
  readonly status: number;
  /** Where the request was stopped: at the token endpoint or at the resource. */
  readonly stoppedAt: 'token endpoint' | 'resource' | 'not stopped';
}
