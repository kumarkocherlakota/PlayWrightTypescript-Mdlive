import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { expect, type Browser } from '@playwright/test';
import { LocatorError, ValidationError } from '@core/errors';
import { FormComponent } from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

const SEARCH_FORM = `
  <form aria-label="Search">
    <label for="keyword">Keyword</label>
    <input id="keyword" name="q">
    <label for="category">Category</label>
    <select id="category"><option>Any</option><option>Hardware</option></select>
    <p id="keyword-error" hidden>Enter at least 2 characters.</p>
    <button type="submit">Search</button>
  </form>
  <output aria-label="Submitted"></output>
  <script>
    document.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const keyword = document.querySelector('#keyword');
      if (keyword.value.length < 2) {
        keyword.setAttribute('aria-invalid', 'true');
        keyword.setAttribute('aria-errormessage', 'keyword-error');
        document.querySelector('#keyword-error').hidden = false;
        return;
      }
      const category = document.querySelector('#category').value;
      const response = await fetch('/api/search?q=' + encodeURIComponent(keyword.value));
      document.querySelector('output').textContent = category + ':' + (await response.text());
    });
  </script>`;

describe('FormComponent', () => {
  let browser: Browser;
  let fixture: BrowserFixture;
  let form: FormComponent;

  before(async () => {
    browser = await launchFixtureBrowser();
  });
  after(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    fixture = await openBrowserFixture(browser, 500);
    fixture.serve('/api/search', { contentType: 'application/json', body: '{"total":1}' });
    await fixture.show(SEARCH_FORM);
    form = new FormComponent(fixture.page.getByRole('form', { name: 'Search' }), fixture.ui);
  });
  afterEach(async () => {
    await fixture.close();
  });

  it('fills, selects and submits by visible labels and button names', async () => {
    await form.fill('Keyword', 'Widget');
    await form.select('Category', 'Hardware');
    await form.submit('Search');
    await expect(fixture.page.getByRole('status', { name: 'Submitted' })).toHaveText(
      'Hardware:{"total":1}',
    );
  });

  it('returns the response triggered by the submit', async () => {
    await form.fill('Keyword', 'Widget');
    const response = await form.submitAndWaitForResponse('Search', (candidate) =>
      candidate.url().includes('/api/search'),
    );
    assert.equal(new URL(response.url()).searchParams.get('q'), 'Widget');
    assert.deepEqual(await response.json(), { total: 1 });
  });

  it('reads the error message associated through aria-errormessage', async () => {
    assert.equal(await form.isInvalid('Keyword'), false);
    await form.fill('Keyword', 'W');
    await form.submit('Search');
    assert.equal(await form.isInvalid('Keyword'), true);
    assert.equal(await form.validationMessageFor('Keyword'), 'Enter at least 2 characters.');
  });

  it('falls back to aria-describedby when aria-errormessage is absent', async () => {
    await fixture.show(`
      <form aria-label="Search">
        <label for="keyword">Keyword</label>
        <input id="keyword" aria-invalid="true" aria-describedby="keyword-hint keyword-error">
        <p id="keyword-hint" hidden>Optional hint</p>
        <p id="keyword-error">Keyword is required.</p>
      </form>`);
    assert.equal(await form.validationMessageFor('Keyword'), 'Keyword is required.');
  });

  it('fails when an invalid field has no visible associated message', async () => {
    await fixture.show(`
      <form aria-label="Search">
        <label for="keyword">Keyword</label>
        <input id="keyword" aria-invalid="true" aria-errormessage='x"],*["'>
        <p>Keyword is required.</p>
      </form>`);
    await assert.rejects(
      form.validationMessageFor('Keyword'),
      (error: unknown) =>
        error instanceof ValidationError && Array.isArray(error.context.referencedIds),
    );
  });

  it('fails with a LocatorError when the field never becomes invalid', async () => {
    await assert.rejects(form.waitUntilInvalid('Keyword'), /form could not mark "Keyword"/);
  });

  it('fails with a LocatorError for a label that does not exist', async () => {
    await assert.rejects(
      form.fill('Member ID', 'SYN-000'),
      (error: unknown) =>
        error instanceof LocatorError &&
        error.message.startsWith('form could not fill "Member ID"'),
    );
  });
});
