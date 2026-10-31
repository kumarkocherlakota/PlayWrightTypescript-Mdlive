import { Given, Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import {
  catalogItemFromRecord,
  ComponentGalleryWorkflow,
  type DialogState,
  type GalleryPageState,
  type SearchAttempt,
  type SearchResults,
} from '@domains/component-gallery';
import type { DialogCloseMethod } from '@bdd/support/parameter-types';
import type { CustomWorld } from '@bdd/world/custom-world';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'gallery.searchResults': SearchResults;
    'gallery.searchAttempt': SearchAttempt;
    'gallery.dialog': DialogState;
    'gallery.page': GalleryPageState;
  }
}

const gallery = (world: CustomWorld): ComponentGalleryWorkflow =>
  new ComponentGalleryWorkflow(world.uiContext);

Given('the component gallery catalog is open', async function (this: CustomWorld) {
  await gallery(this).openCatalog();
});

Given(
  /^the user (?:searches|has searched) the catalog for "([^"]*)" in the "([^"]*)" category$/,
  async function (this: CustomWorld, keyword: string, category: string) {
    this.state.set('gallery.searchResults', await gallery(this).search({ keyword, category }));
  },
);

When(
  'the user submits a catalog search with the keyword {string}',
  async function (this: CustomWorld, keyword: string) {
    this.state.set('gallery.searchAttempt', await gallery(this).attemptSearch({ keyword }));
  },
);

When(
  'the user submits a catalog search with a keyword of {int} characters',
  async function (this: CustomWorld, length: number) {
    const keyword = 'k'.repeat(length);
    this.state.set('gallery.searchAttempt', await gallery(this).attemptSearch({ keyword }));
  },
);

Then('the search is announced as {string}', function (this: CustomWorld, expected: string) {
  expect(this.state.get('gallery.searchResults').announcement).toBe(expected);
});

Then(
  'the results table lists exactly these items:',
  function (this: CustomWorld, table: DataTable) {
    const expected = table.hashes().map(catalogItemFromRecord);
    expect(this.state.get('gallery.searchResults').items).toEqual(expected);
  },
);

Then('the results table lists no items', function (this: CustomWorld) {
  expect(this.state.get('gallery.searchResults').items).toEqual([]);
});

Then('the search is accepted', function (this: CustomWorld) {
  expect(this.state.get('gallery.searchAttempt').accepted).toBe(true);
});

Then(
  'the search is rejected with the message {string}',
  function (this: CustomWorld, message: string) {
    expect(this.state.get('gallery.searchAttempt')).toEqual({
      accepted: false,
      validationMessage: message,
    });
  },
);

When('the user opens the details of {string}', async function (this: CustomWorld, name: string) {
  this.state.set('gallery.dialog', await gallery(this).openItemDetails(name));
});

Then(
  'a dialog titled {string} is shown with keyboard focus inside it',
  function (this: CustomWorld, title: string) {
    expect(this.state.get('gallery.dialog')).toEqual({ title, hasFocus: true });
  },
);

When(
  'the user closes the details dialog with the {dialogCloseMethod}',
  async function (this: CustomWorld, method: DialogCloseMethod) {
    await gallery(this).closeItemDetails(method === 'Escape key' ? 'escape' : 'button');
  },
);

Then('no details dialog is shown', async function (this: CustomWorld) {
  expect(await gallery(this).isItemDetailsOpen()).toBe(false);
});

When(
  'the user navigates to the {string} section',
  async function (this: CustomWorld, section: string) {
    expect(['Catalog', 'About']).toContain(section);
    const target = section === 'About' ? 'About' : 'Catalog';
    this.state.set('gallery.page', await gallery(this).navigateTo(target));
  },
);

Then('the page heading is {string}', function (this: CustomWorld, heading: string) {
  expect(this.state.get('gallery.page').heading).toBe(heading);
});

Then(
  '{string} is marked as the current navigation item',
  function (this: CustomWorld, item: string) {
    expect(this.state.get('gallery.page').currentNavigationItem).toBe(item);
  },
);
