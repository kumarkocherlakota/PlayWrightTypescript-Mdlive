import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import {
  InventoryWorkflow,
  type AccessAttempt,
  type AccessMethod,
  type InventoryItem,
  type InventoryList,
  type NewInventoryItem,
  type RequestOutcome,
} from '@domains/inventory';
import { findCredentialLeaks } from '@bdd/support/credential-leak-probe';
import type { CustomWorld } from '@bdd/world/custom-world';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'inventory.requested': NewInventoryItem;
    'inventory.stored': InventoryItem;
    'inventory.outcome': RequestOutcome<unknown>;
    'inventory.batch': { readonly skuPrefix: string; readonly size: number };
    'inventory.list': InventoryList;
    'inventory.access': AccessAttempt;
  }
}

const inventory = (world: CustomWorld): InventoryWorkflow =>
  new InventoryWorkflow(world.apiContext);

Given(
  /^the test user (?:stocks|has stocked) a new synthetic inventory item$/,
  async function (this: CustomWorld) {
    const requested = inventory(this).newItem().build();
    this.state.set('inventory.requested', requested);
    this.state.set('inventory.stored', await inventory(this).stock(requested));
  },
);

Then('the item is stored exactly as requested', function (this: CustomWorld) {
  const requested = this.state.get('inventory.requested');
  expect(this.state.get('inventory.stored')).toMatchObject({ ...requested });
});

Then('the stored item can be retrieved by its identifier', async function (this: CustomWorld) {
  const stored = this.state.get('inventory.stored');
  expect(await inventory(this).retrieve(stored.id)).toEqual(stored);
});

When(
  'the test user tries to stock an item with a quantity of {int}',
  async function (this: CustomWorld, quantity: number) {
    const payload = inventory(this).newItem().withQuantity(quantity).build();
    this.state.set('inventory.outcome', await inventory(this).attemptToStock(payload));
  },
);

When(
  'the test user tries to stock an item with a name of {int} characters',
  async function (this: CustomWorld, length: number) {
    const payload = inventory(this).newItem().withNameOfLength(length).build();
    this.state.set('inventory.outcome', await inventory(this).attemptToStock(payload));
  },
);

When(
  'the test user tries to stock another item with the same SKU',
  async function (this: CustomWorld) {
    const { sku } = this.state.get('inventory.stored');
    const payload = inventory(this).newItem().withSku(sku).build();
    this.state.set('inventory.outcome', await inventory(this).attemptToStock(payload));
  },
);

When(
  'the test user tries to stock an item with an unrecognized {string} field',
  async function (this: CustomWorld, field: string) {
    const payload = inventory(this)
      .newItem()
      .buildPayloadWith({ [field]: 10 });
    this.state.set('inventory.outcome', await inventory(this).attemptToStock(payload));
  },
);

When(
  'the test user lists inventory with a page size of {int}',
  async function (this: CustomWorld, limit: number) {
    this.state.set('inventory.outcome', await inventory(this).attemptToList({ limit }));
  },
);

Then('the request is accepted', function (this: CustomWorld) {
  expect(this.state.get('inventory.outcome')).toMatchObject({ accepted: true });
});

Then(
  'the request is rejected because {string} is invalid',
  function (this: CustomWorld, field: string) {
    expect(this.state.get('inventory.outcome')).toEqual({
      accepted: false,
      status: 400,
      error: 'validation_failed',
      invalidFields: [field],
    });
  },
);

Then('the request is refused as a duplicate', function (this: CustomWorld) {
  expect(this.state.get('inventory.outcome')).toMatchObject({
    accepted: false,
    status: 409,
    error: 'duplicate_sku',
  });
});

Given(
  'the test user has stocked a batch of {int} synthetic inventory items',
  async function (this: CustomWorld, size: number) {
    const { skuPrefix } = await inventory(this).stockBatch(size);
    this.state.set('inventory.batch', { skuPrefix, size });
  },
);

When(
  'the test user lists the batch with a page size of {int}',
  async function (this: CustomWorld, limit: number) {
    const { skuPrefix } = this.state.get('inventory.batch');
    this.state.set('inventory.list', await inventory(this).list({ skuPrefix, limit }));
  },
);

Then(
  '{int} items of the batch are returned out of {int} matching items',
  function (this: CustomWorld, returned: number, total: number) {
    const { skuPrefix } = this.state.get('inventory.batch');
    const list = this.state.get('inventory.list');
    expect(list.total).toBe(total);
    expect(list.items).toHaveLength(returned);
    expect(list.items.every((item) => item.sku.startsWith(skuPrefix))).toBe(true);
  },
);

When('the test user removes the item', async function (this: CustomWorld) {
  await inventory(this).remove(this.state.get('inventory.stored').id);
});

When('the test-data cleanup of the scenario runs', async function (this: CustomWorld) {
  await inventory(this).cleanUpNow();
});

Then('the item can no longer be retrieved', async function (this: CustomWorld) {
  expect(await inventory(this).retrieve(this.state.get('inventory.stored').id)).toBeUndefined();
});

When(
  'a caller with {accessMethod} lists inventory',
  async function (this: CustomWorld, access: AccessMethod) {
    this.state.set('inventory.access', await inventory(this).attemptToListWith(access));
  },
);

Then(
  /^access is refused at the (token endpoint|resource) with HTTP status (\d{3})$/,
  function (this: CustomWorld, stage: string, status: string) {
    expect(this.state.get('inventory.access')).toEqual({
      granted: false,
      status: Number(status),
      stoppedAt: stage,
    });
  },
);

Then(
  'the scenario log records the token request and the authenticated call',
  function (this: CustomWorld) {
    const messages = this.logBuffer.entries().map((entry) => entry.message);
    expect(messages).toContainEqual(expect.stringMatching(/^HTTP POST \S+\/token -> 200 /));
    expect(messages).toContainEqual(
      expect.stringMatching(/^HTTP POST \S+\/inventory\/items -> 201 /),
    );
  },
);

Then('the scenario log contains no access token or credential', function (this: CustomWorld) {
  expect(findCredentialLeaks(this.logBuffer.toJsonLines())).toEqual([]);
});
