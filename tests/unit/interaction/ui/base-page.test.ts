import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { expect, type Browser } from '@playwright/test';
import { NavigationError } from '@core/errors';
import { BasePage, type UiContext } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

class ReportsPage extends BasePage {
  protected readonly path = '/reports';
  public readonly name = 'Reports page';

  public constructor(ui: UiContext) {
    super(ui);
  }

  public async waitUntilReady(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: this.ui.expectTimeoutMs,
    });
  }
}

const READY_PAGE = '<!doctype html><html lang="en"><body><h1>Reports</h1></body></html>';

function isNavigationError(status?: number) {
  return (error: unknown) =>
    error instanceof NavigationError &&
    error.context.page === 'Reports page' &&
    error.context.path === '/reports' &&
    (status === undefined || error.context.status === status);
}

describe('BasePage', () => {
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

  it('opens its path and resolves once the page is ready', async () => {
    fixture.serve('/reports', { body: READY_PAGE });
    await new ReportsPage(fixture.ui).open();
    assert.equal(new URL(fixture.page.url()).pathname, '/reports');
  });

  it('fails with the HTTP status when the response is not OK', async () => {
    fixture.serve('/reports', { status: 503, body: 'Service unavailable' });
    await assert.rejects(new ReportsPage(fixture.ui).open(), isNavigationError(503));
  });

  it('wraps navigation failures with the original error as cause', async () => {
    await fixture.page.route('**/reports', (route) => route.abort('connectionrefused'));
    await assert.rejects(
      new ReportsPage(fixture.ui).open(),
      (error: unknown) =>
        isNavigationError()(error) && error instanceof Error && error.cause !== undefined,
    );
  });

  it('propagates readiness failures after navigation', async () => {
    fixture.serve('/reports', {
      body: '<!doctype html><html lang="en"><body>Loading</body></html>',
    });
    await assert.rejects(new ReportsPage(fixture.ui).open(), /Reports/);
  });

  it('waits for in-app navigation to arrive at its path', async () => {
    fixture.serve('/reports', { body: READY_PAGE });
    await fixture.show('<a href="/reports">Reports</a>');
    await fixture.page.getByRole('link', { name: 'Reports' }).click();
    await new ReportsPage(fixture.ui).waitUntilLoaded();
  });

  it('fails when in-app navigation never arrives at its path', async () => {
    await fixture.show('<h1>Home</h1>');
    await assert.rejects(new ReportsPage(fixture.ui).waitUntilLoaded(), isNavigationError());
  });
});
