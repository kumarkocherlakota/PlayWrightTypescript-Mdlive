import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Browser } from '@playwright/test';
import { LocatorError } from '@core/errors';
import { DialogComponent } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

const ITEM_DIALOG = `
  <button id="open">Open details</button>
  <dialog aria-labelledby="dialog-title">
    <h2 id="dialog-title">Widget Alpha</h2>
    <button id="close">Close</button>
    <button>Keep open</button>
  </dialog>
  <script>
    const dialog = document.querySelector('dialog');
    document.querySelector('#open').addEventListener('click', () => {
      dialog.showModal();
      document.querySelector('#close').focus();
    });
    document.querySelector('#close').addEventListener('click', () => dialog.close());
  </script>`;

describe('DialogComponent', () => {
  let browser: Browser;
  let fixture: BrowserFixture;
  let dialog: DialogComponent;

  before(async () => {
    browser = await launchFixtureBrowser();
  });
  after(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    fixture = await openBrowserFixture(browser, 500);
    await fixture.show(ITEM_DIALOG);
    await fixture.page.getByRole('button', { name: 'Open details' }).click();
    dialog = new DialogComponent(fixture.page.getByRole('dialog'), fixture.ui, 'item details');
  });
  afterEach(async () => {
    await fixture.close();
  });

  it('reads its title from the heading', async () => {
    assert.equal(await dialog.title(), 'Widget Alpha');
  });

  it('reports whether keyboard focus is inside the dialog', async () => {
    assert.equal(await dialog.containsFocus(), true);
    await fixture.page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    assert.equal(await dialog.containsFocus(), false);
  });

  it('closes with the Close button and waits until it is hidden', async () => {
    await dialog.close();
    assert.equal(await dialog.isVisible(), false);
  });

  it('closes with the Escape key', async () => {
    await dialog.closeWithEscape();
    assert.equal(await dialog.isVisible(), false);
  });

  it('fails with a LocatorError when the button does not close the dialog', async () => {
    await assert.rejects(
      dialog.close('Keep open'),
      (error: unknown) =>
        error instanceof LocatorError &&
        error.message.startsWith('item details could not become hidden'),
    );
  });
});
