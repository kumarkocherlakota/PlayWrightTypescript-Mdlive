import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Browser } from '@playwright/test';
import { LocatorError, ValidationError } from '@core/errors';
import {
  AccessibilityScanner,
  assertNoBlockingViolations,
  axeTagsFor,
  focusNextKey,
  KeyboardNavigation,
  MANUAL_TESTING_NOTE,
  reachesThreshold,
} from '@interaction/ui';
import { launchFixtureBrowser, openBrowserFixture, type BrowserFixture } from './browser-fixture';

function documentWith(body: string): string {
  return `<!doctype html><html lang="en"><head><title>Fixture</title>
    <style>:focus-visible { outline: 3px solid #0b57d0; } .no-ring:focus { outline: none; }</style>
    </head><body><main><h1>Fixture</h1>${body}</main></body></html>`;
}

const ACCESSIBLE_FORM = documentWith(`
  <form aria-label="Contact">
    <label for="email">Email</label><input id="email" type="email" />
    <button type="submit">Send</button>
  </form>`);

// An unlabelled field (critical) and low-contrast text (serious). The value attribute stands in
// for personal data that must not reach the result.
const INACCESSIBLE_FORM = documentWith(`
  <form aria-label="Contact">
    <input id="name" type="text" value="Synthetic Person" />
    <p style="color:#bbb;background:#fff">Low contrast hint</p>
  </form>`);

describe('WCAG target', () => {
  it('includes lower conformance levels in each target', () => {
    assert.deepEqual(axeTagsFor('wcag2a'), ['wcag2a']);
    assert.deepEqual(axeTagsFor('wcag22aa'), [
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
    ]);
  });

  it('blocks at or above the threshold and when the impact is unknown', () => {
    assert.equal(reachesThreshold('serious', 'serious'), true);
    assert.equal(reachesThreshold('critical', 'serious'), true);
    assert.equal(reachesThreshold('moderate', 'serious'), false);
    assert.equal(reachesThreshold(null, 'critical'), true);
  });
});

describe('focusNextKey', () => {
  it('uses Option+Tab only for WebKit on macOS, where Tab skips buttons and links', () => {
    assert.equal(focusNextKey('webkit', 'darwin'), 'Alt+Tab');
    assert.equal(focusNextKey('webkit', 'linux'), 'Tab');
    assert.equal(focusNextKey('chromium', 'darwin'), 'Tab');
    assert.equal(focusNextKey(undefined, 'darwin'), 'Tab');
  });
});

describe('AccessibilityScanner and KeyboardNavigation', () => {
  let browser: Browser;
  let fixture: BrowserFixture;

  before(async () => {
    browser = await launchFixtureBrowser();
  });
  after(async () => {
    await browser.close();
  });
  beforeEach(async () => {
    fixture = await openBrowserFixture(browser, 2_000);
  });
  afterEach(async () => {
    await fixture.close();
  });

  async function open(html: string): Promise<void> {
    fixture.serve('/page', { body: html });
    await fixture.page.goto('/page?member=synthetic');
  }

  it('reports no violations for an accessible page', async () => {
    await open(ACCESSIBLE_FORM);
    const scanner = new AccessibilityScanner(fixture.ui, {
      standard: 'wcag22aa',
      failOnImpact: 'minor',
    });
    const result = await scanner.scan('contact form');
    assert.deepEqual(result.violations, []);
    assert.ok(result.passedRules > 0);
    assert.equal(result.page, 'http://ui-fixture.test/page');
    assert.equal(result.note, MANUAL_TESTING_NOTE);
    assert.doesNotThrow(() => {
      assertNoBlockingViolations(result);
    });
  });

  it('marks violations at the threshold as blocking and leaves element HTML out', async () => {
    await open(INACCESSIBLE_FORM);
    const scanner = new AccessibilityScanner(fixture.ui, {
      standard: 'wcag22aa',
      failOnImpact: 'critical',
    });
    const result = await scanner.scan('contact form');
    const byRule = new Map(result.violations.map((violation) => [violation.rule, violation]));
    assert.equal(byRule.get('label')?.blocking, true);
    assert.equal(byRule.get('color-contrast')?.blocking, false);
    assert.deepEqual(byRule.get('label')?.targets, ['#name']);
    assert.ok(!JSON.stringify(result).includes('Synthetic Person'));
    assert.throws(
      () => {
        assertNoBlockingViolations(result);
      },
      (error: unknown) =>
        error instanceof ValidationError &&
        error.message.includes(
          'contact form has accessibility violations at or above "critical"',
        ) &&
        error.message.includes('label (critical, 1 elements)') &&
        !error.message.includes('color-contrast'),
    );
  });

  it('records focus stops with their accessible names and focus indicators', async () => {
    await open(
      documentWith(`
        <label for="email">Email</label><input id="email" type="email" />
        <button type="button">Send</button>
        <button type="button" class="no-ring">Hidden ring</button>`),
    );
    const stops = await new KeyboardNavigation(fixture.ui).tabThrough(3);
    assert.deepEqual(stops, [
      { role: 'textbox', name: 'Email', indicatorVisible: true },
      { role: 'button', name: 'Send', indicatorVisible: true },
      { role: 'button', name: 'Hidden ring', indicatorVisible: false },
    ]);
  });

  it('fails when focus leaves the page content', async () => {
    await open(documentWith('<p>No focusable element</p>'));
    await assert.rejects(
      new KeyboardNavigation(fixture.ui).tabThrough(1),
      (error: unknown) => error instanceof LocatorError,
    );
  });
});
