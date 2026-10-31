import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LocatorError } from '@core/errors';
import { uiActionFailed } from '@interaction/ui';

describe('uiActionFailed', () => {
  it('names the target and action and keeps the original error as cause', () => {
    const cause = new Error('Timeout 1000ms exceeded.');
    const error = uiActionFailed('search form', 'submit with "Search"', cause);
    assert.ok(error instanceof LocatorError);
    assert.equal(
      error.message,
      'search form could not submit with "Search": Timeout 1000ms exceeded.',
    );
    assert.equal(error.cause, cause);
    assert.deepEqual(error.context, { target: 'search form', action: 'submit with "Search"' });
  });

  it('strips terminal colors and keeps only the first three lines of the cause', () => {
    const cause = new Error('\u001b[31mline 1\u001b[39m\nline 2\nline 3\nline 4\nline 5');
    const error = uiActionFailed('table', 'show 2 rows', cause);
    assert.equal(error.message, 'table could not show 2 rows: line 1 | line 2 | line 3');
  });

  it('describes causes that are not Error instances', () => {
    const error = uiActionFailed('dialog', 'close', 'target closed');
    assert.equal(error.message, 'dialog could not close: target closed');
  });
});
