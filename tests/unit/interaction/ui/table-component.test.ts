import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Browser } from '@playwright/test';
import { LocatorError, ValidationError } from '@core/errors';
import { TableComponent } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

const CATALOG_TABLE = `
  <table aria-label="Catalog">
    <thead><tr><th>Name</th><th>Status</th><th><span hidden>Actions</span></th></tr></thead>
    <tbody>
      <tr><td>Widget Alpha</td><td>Available</td><td><button>View</button></td></tr>
      <tr><td>Widget Beta</td><td>Discontinued</td><td><button>View</button></td></tr>
    </tbody>
  </table>
  <p role="status" aria-label="Selected"></p>
  <script>
    for (const button of document.querySelectorAll('button')) {
      button.addEventListener('click', () => {
        document.querySelector('[role=status]').textContent =
          button.closest('tr').cells[0].textContent;
      });
    }
  </script>`;

describe('TableComponent', () => {
  let browser: Browser;
  let fixture: BrowserFixture;
  let table: TableComponent;

  before(async () => {
    browser = await launchFixtureBrowser();
  });
  after(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    fixture = await openBrowserFixture(browser, 500);
    await fixture.show(CATALOG_TABLE);
    table = new TableComponent(fixture.page.getByRole('table', { name: 'Catalog' }), fixture.ui);
  });
  afterEach(async () => {
    await fixture.close();
  });

  it('reads headers and counts only data rows', async () => {
    assert.deepEqual(await table.headers(), ['Name', 'Status', '']);
    assert.equal(await table.rowCount(), 2);
    await table.waitForRowCount(2);
  });

  it('reads rows keyed by header and skips columns without a header', async () => {
    assert.deepEqual(await table.readRows(), [
      { Name: 'Widget Alpha', Status: 'Available' },
      { Name: 'Widget Beta', Status: 'Discontinued' },
    ]);
  });

  it('clicks the button inside the row that contains the text', async () => {
    await table.clickInRow('Widget Beta', 'View');
    assert.equal(
      await fixture.page.getByRole('status', { name: 'Selected' }).innerText(),
      'Widget Beta',
    );
  });

  it('rejects rows whose cell count does not match the headers', async () => {
    await fixture.show(`
      <table aria-label="Catalog">
        <tr><th>Name</th><th>Status</th></tr>
        <tr><td>Widget Alpha</td></tr>
      </table>`);
    await assert.rejects(table.readRows(), ValidationError);
  });

  it('fails with a LocatorError when the row count never matches', async () => {
    await assert.rejects(
      table.waitForRowCount(3),
      (error: unknown) =>
        error instanceof LocatorError && error.message.startsWith('table could not show 3 rows'),
    );
  });
});
