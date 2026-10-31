import type { ApiResponse, HttpClient, SchemaValidator } from '@interaction/api';
import type {
  InventoryItem,
  InventoryList,
  ListCriteria,
  NewInventoryItem,
  RequestOutcome,
} from '../models/inventory-item';
import {
  apiErrorSchema,
  inventoryItemSchema,
  inventoryListSchema,
} from '../schemas/inventory-schemas';

const ITEMS = '/inventory/items';

/**
 * Typed client for the inventory API. Every successful response is checked against its contract;
 * `attempt…` methods return rejections as values for negative and boundary tests instead of
 * throwing.
 */
export class InventoryClient {
  public constructor(
    private readonly http: HttpClient,
    private readonly validator: SchemaValidator,
  ) {}

  public async create(item: NewInventoryItem): Promise<InventoryItem> {
    const response = await this.http.post(ITEMS, { json: item, expectedStatus: 201 });
    return this.item(response);
  }

  /** Submits any payload, including deliberately invalid ones. */
  public async attemptCreate(payload: unknown): Promise<RequestOutcome<InventoryItem>> {
    const response = await this.http.post(ITEMS, { json: payload });
    return response.status === 201
      ? { accepted: true, status: 201, value: this.item(response) }
      : this.rejection(response);
  }

  /** Returns the item, or undefined when the service reports that it does not exist. */
  public async find(id: string): Promise<InventoryItem | undefined> {
    const response = await this.http.get(itemPath(id), { expectedStatus: [200, 404] });
    return response.status === 404 ? undefined : this.item(response);
  }

  public async list(criteria: ListCriteria = {}): Promise<InventoryList> {
    const response = await this.http.get(ITEMS, { query: { ...criteria }, expectedStatus: 200 });
    return this.validator.validate(inventoryListSchema, response.body, 'inventory list');
  }

  public async attemptList(criteria: ListCriteria = {}): Promise<RequestOutcome<InventoryList>> {
    const response = await this.http.get(ITEMS, { query: { ...criteria } });
    return response.status === 200
      ? {
          accepted: true,
          status: 200,
          value: this.validator.validate(inventoryListSchema, response.body, 'inventory list'),
        }
      : this.rejection(response);
  }

  public async delete(id: string): Promise<void> {
    await this.http.delete(itemPath(id), { expectedStatus: 204 });
  }

  /** Deletes the item if it still exists; returns false when it was already gone. */
  public async deleteIfPresent(id: string): Promise<boolean> {
    const response = await this.http.delete(itemPath(id), { expectedStatus: [204, 404] });
    return response.status === 204;
  }

  private item(response: ApiResponse): InventoryItem {
    return this.validator.validate(inventoryItemSchema, response.body, 'inventory item');
  }

  private rejection(response: ApiResponse): RequestOutcome<never> {
    const body = this.validator.validate(apiErrorSchema, response.body, 'API error');
    return {
      accepted: false,
      status: response.status,
      error: body.error,
      invalidFields: (body.details ?? []).map((detail) => detail.field),
    };
  }
}

function itemPath(id: string): string {
  return `${ITEMS}/${encodeURIComponent(id)}`;
}
