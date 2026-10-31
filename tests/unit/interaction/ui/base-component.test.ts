import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Browser } from '@playwright/test';
import { LocatorError } from '@core/errors';
import { BaseComponent, type UiContext } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

class PanelComponent extends BaseComponent {
  public constructor(ui: UiContext) {
    super(ui.page.getByRole('region', { name: 'Details' }), ui, 'details panel');
  }

  public clickMissingButton(): Promise<void> {
    return this.perform('press "Missing"', () =>
      this.root.getByRole('button', { name: 'Missing' }).click(),
    );
  }
}

describe('BaseComponent', () => {
  let browser: Browser;
  let fixture: BrowserFixture;

  before(async () => {
    browser = await launchFixtureBrowser();
  });
  after(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    fixture = await openBrowserFixture(browser, 500);
  });
  afterEach(async () => {
    await fixture.close();
  });

  it('waits for the root to become visible', async () => {
    await fixture.show(`
      <section aria-label="Details" hidden>Synthetic details</section>
      <script>setTimeout(() => document.querySelector('section').hidden = false, 100);</script>`);
    const panel = new PanelComponent(fixture.ui);
    assert.equal(await panel.isVisible(), false);
    await panel.waitUntilVisible();
    assert.equal(await panel.isVisible(), true);
  });

  it('waits for the root to become hidden', async () => {
    await fixture.show(`
      <section aria-label="Details">Synthetic details</section>
      <script>setTimeout(() => document.querySelector('section').hidden = true, 100);</script>`);
    await new PanelComponent(fixture.ui).waitUntilHidden();
  });

  it('reports a timeout as a LocatorError naming the component and action', async () => {
    await fixture.show('<p>No details here</p>');
    await assert.rejects(
      new PanelComponent(fixture.ui).waitUntilVisible(),
      (error: unknown) =>
        error instanceof LocatorError &&
        error.message.startsWith('details panel could not become visible:') &&
        error.cause instanceof Error,
    );
  });

  it('logs each action at debug level before running it', async () => {
    await fixture.show('<section aria-label="Details">Synthetic details</section>');
    const panel = new PanelComponent(fixture.ui);
    await assert.rejects(panel.clickMissingButton(), LocatorError);
    assert.ok(
      fixture.logs
        .entries()
        .some(
          (entry) => entry.level === 'debug' && entry.message === 'details panel: press "Missing"',
        ),
    );
  });
});
