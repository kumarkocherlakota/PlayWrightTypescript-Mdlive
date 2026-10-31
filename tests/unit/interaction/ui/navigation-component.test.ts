import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Browser } from '@playwright/test';
import { LocatorError } from '@core/errors';
import { NavigationComponent } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

const MENU = `
  <nav aria-label="Main">
    <a href="/" aria-current="page">Catalog</a>
    <a href="/about">About</a>
  </nav>`;

describe('NavigationComponent', () => {
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

  function mainMenu(): NavigationComponent {
    return new NavigationComponent(
      fixture.page.getByRole('navigation', { name: 'Main' }),
      fixture.ui,
      'main menu',
    );
  }

  it('reports the link marked as the current page', async () => {
    await fixture.show(MENU);
    assert.equal(await mainMenu().currentItem(), 'Catalog');
  });

  it('reports no current item when no link is marked', async () => {
    await fixture.show('<nav aria-label="Main"><a href="/about">About</a></nav>');
    assert.equal(await mainMenu().currentItem(), undefined);
  });

  it('follows a link by its accessible name', async () => {
    fixture.serve('/about', { body: '<!doctype html><html lang="en"><body>About</body></html>' });
    await fixture.show(MENU);
    await mainMenu().goTo('About');
    await fixture.page.waitForURL('**/about');
  });

  it('fails with a LocatorError for a link that does not exist', async () => {
    await fixture.show(MENU);
    await assert.rejects(
      mainMenu().goTo('Billing'),
      (error: unknown) =>
        error instanceof LocatorError &&
        error.message.startsWith('main menu could not follow "Billing"'),
    );
  });
});
