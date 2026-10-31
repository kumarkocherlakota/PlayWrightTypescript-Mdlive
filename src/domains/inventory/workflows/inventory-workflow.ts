import { randomBytes } from 'node:crypto';
import { AuthenticationError } from '@core/errors';
import { Secret } from '@core/security';
import { syntheticSensitiveValue } from '@core/test-data';
import { NoAuth, StaticBearerAuth, type ApiContext, type AuthStrategy } from '@interaction/api';
import { InventoryClient } from '../api/inventory-client';
import { InventoryItemBuilder } from '../builders/inventory-item-builder';
import type {
  AccessAttempt,
  AccessMethod,
  InventoryItem,
  InventoryList,
  ListCriteria,
  NewInventoryItem,
  RequestOutcome,
} from '../models/inventory-item';
import { assertStoredAsRequested } from '../validators/stored-item-validator';

/**
 * Inventory processes for the framework's API self-tests. Everything it creates is registered
 * for cleanup immediately, so scenarios leave no data behind even when they fail.
 */
export class InventoryWorkflow {
  public constructor(private readonly api: ApiContext) {}

  /** A builder for a valid, unique synthetic item; adjust only what the scenario is about. */
  public newItem(): InventoryItemBuilder {
    return new InventoryItemBuilder(this.api.ids);
  }

  /** Stocks an item and verifies the service stored exactly what was requested. */
  public async stock(item: NewInventoryItem): Promise<InventoryItem> {
    const created = await this.client().create(item);
    this.registerCleanup(created);
    assertStoredAsRequested(created, item, this.api.ids.marker);
    return created;
  }

  /**
   * Stocks `count` items whose SKUs share a prefix unique to this call, so listings filtered by
   * that prefix see only these items even while other scenarios run in parallel.
   */
  public async stockBatch(count: number): Promise<{ skuPrefix: string; items: InventoryItem[] }> {
    const skuPrefix = `${this.api.ids.next('BATCH')}-`;
    const items: InventoryItem[] = [];
    for (let index = 1; index <= count; index += 1) {
      items.push(await this.stock(this.newItem().withSku(`${skuPrefix}${index}`).build()));
    }
    return { skuPrefix, items };
  }

  /** Submits a payload that may be rejected; accepted items are still cleaned up. */
  public async attemptToStock(payload: unknown): Promise<RequestOutcome<InventoryItem>> {
    const outcome = await this.client().attemptCreate(payload);
    if (outcome.accepted) {
      this.registerCleanup(outcome.value);
    }
    return outcome;
  }

  public retrieve(id: string): Promise<InventoryItem | undefined> {
    return this.client().find(id);
  }

  public remove(id: string): Promise<void> {
    return this.client().delete(id);
  }

  public list(criteria: ListCriteria): Promise<InventoryList> {
    return this.client().list(criteria);
  }

  public attemptToList(criteria: ListCriteria): Promise<RequestOutcome<InventoryList>> {
    return this.client().attemptList(criteria);
  }

  /** Runs the cleanup registered so far, exactly as the After hook would. */
  public async cleanUpNow(): Promise<void> {
    await this.api.cleanup.runAllOrThrow();
  }

  /** Lists inventory using a particular kind of credentials and reports how far it got. */
  public async attemptToListWith(access: AccessMethod): Promise<AccessAttempt> {
    const client = this.client(this.api.session.clientWith(this.strategyFor(access)));
    try {
      const outcome = await client.attemptList({ limit: 1 });
      return {
        granted: outcome.accepted,
        status: outcome.status,
        stoppedAt: outcome.accepted ? 'not stopped' : 'resource',
      };
    } catch (error: unknown) {
      // A refused token request is the expected result for unknown credentials, not a failure.
      if (error instanceof AuthenticationError && typeof error.context.status === 'number') {
        return { granted: false, status: error.context.status, stoppedAt: 'token endpoint' };
      }
      throw error;
    }
  }

  private strategyFor(access: AccessMethod): AuthStrategy {
    switch (access) {
      case 'no credentials':
        return new NoAuth();
      case 'an invalid token':
        return new StaticBearerAuth(`synthetic.${randomBytes(16).toString('base64url')}.invalid`);
      case 'unknown credentials':
        return this.api.session.passwordGrant(
          new Secret('synthetic username', syntheticSensitiveValue('email address')),
          new Secret('synthetic password', syntheticSensitiveValue('password')),
        );
    }
  }

  private client(http = this.api.session.client()): InventoryClient {
    return new InventoryClient(http, this.api.session.validator);
  }

  private registerCleanup(item: InventoryItem): void {
    const client = this.client();
    this.api.cleanup.register(`delete inventory item ${item.sku}`, async () => {
      await client.deleteIfPresent(item.id);
    });
  }
}
