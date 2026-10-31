import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Browser } from '@playwright/test';
import { LocatorError } from '@core/errors';
import { NotificationComponent } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

describe('NotificationComponent', () => {
  let browser: Browser;
  let fixture: BrowserFixture;
  let status: NotificationComponent;

  before(async () => {
    browser = await launchFixtureBrowser();
  });
  after(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    fixture = await openBrowserFixture(browser, 500);
    await fixture.show(`
      <p role="status">Searching…</p>
      <script>
        setTimeout(() => document.querySelector('[role=status]').textContent = '  2 results found ', 100);
      </script>`);
    status = new NotificationComponent(
      fixture.page.getByRole('status'),
      fixture.ui,
      'search status',
    );
  });
  afterEach(async () => {
    await fixture.close();
  });

  it('waits for an exact announcement and returns the trimmed text', async () => {
    assert.equal(await status.waitForMessage('2 results found'), '2 results found');
  });

  it('accepts a pattern for announcements with variable content', async () => {
    assert.equal(await status.waitForMessage(/^\d+ results? found$/), '2 results found');
  });

  it('fails with a LocatorError when the announcement never appears', async () => {
    await assert.rejects(
      status.waitForMessage('No results found'),
      (error: unknown) =>
        error instanceof LocatorError &&
        error.message.startsWith('search status could not announce No results found'),
    );
  });
});
