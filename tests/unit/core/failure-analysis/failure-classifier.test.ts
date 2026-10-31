import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ApiRequestError,
  AuthenticationError,
  ConfigurationError,
  LocatorError,
  NavigationError,
  TestDataError,
  ValidationError,
} from '@core/errors';
import {
  classifyFailure,
  evidenceFromError,
  FAILURE_CATEGORIES,
  FAILURE_CATEGORY_IDS,
  type FailureCategoryId,
  type FailureEvidence,
} from '@core/failure-analysis';

function categoryOf(error: unknown): FailureCategoryId {
  return classifyFailure(evidenceFromError(error)).category;
}

describe('classifyFailure', () => {
  it('treats undefined, pending and ambiguous steps as automation gaps', () => {
    for (const outcome of ['undefined', 'pending', 'ambiguous'] as const) {
      const result = classifyFailure({ outcome });
      assert.equal(result.category, 'automation-gap');
      assert.match(result.reason, new RegExp(outcome));
    }
  });

  it('maps framework error codes to their categories', () => {
    const cases: [Error, FailureCategoryId][] = [
      [new ConfigurationError('Invalid configuration for "qa".'), 'configuration'],
      [new TestDataError('2 cleanup actions failed.'), 'test-data'],
      [new AuthenticationError('Token request was refused.'), 'authentication'],
      [new LocatorError('catalog search form could not fill "Keyword": Timeout'), 'locator'],
      [new ValidationError('Inventory item X was not stored as requested: name.'), 'assertion'],
    ];
    for (const [error, expected] of cases) {
      assert.equal(categoryOf(error), expected, error.message);
    }
  });

  it('separates API failures by what went wrong', () => {
    const cases: [string, FailureCategoryId][] = [
      ['GET /api/items failed before a response arrived.', 'environment'],
      ['GET /api/items returned HTTP 503; expected 200.', 'environment'],
      ['GET /api/items returned HTTP 401; expected 200.', 'authentication'],
      ['GET /api/items returned HTTP 403; expected 200.', 'authentication'],
      ['GET /api/items returned invalid JSON.', 'contract'],
      ['POST /api/items returned HTTP 400; expected 201.', 'api-error'],
    ];
    for (const [message, expected] of cases) {
      assert.equal(categoryOf(new ApiRequestError(message)), expected, message);
    }
  });

  it('classifies contract violations and navigation problems', () => {
    assert.equal(
      categoryOf(new ValidationError('Response does not match the InventoryItem contract: /id')),
      'contract',
    );
    assert.equal(
      categoryOf(new NavigationError('Could not open Catalog at /gallery.')),
      'environment',
    );
    assert.equal(
      categoryOf(new NavigationError('Catalog responded with HTTP 502.')),
      'environment',
    );
    assert.equal(
      categoryOf(new NavigationError('Expected to arrive at Catalog (/gallery).')),
      'assertion',
    );
  });

  it('recognizes Playwright and Cucumber messages without a framework code', () => {
    const cases: [FailureEvidence, FailureCategoryId][] = [
      [
        {
          errorName: 'Error',
          message: 'expect(received).toBe(expected)\nExpected: "3"\nReceived: "2"',
        },
        'assertion',
      ],
      [{ errorName: 'TimeoutError', message: 'page.goto: Timeout 15000ms exceeded.' }, 'timeout'],
      [
        {
          errorName: 'Error',
          message: 'function timed out, ensure the promise resolves within 30000 milliseconds',
        },
        'timeout',
      ],
      [
        {
          errorName: 'Error',
          message: 'locator.click: strict mode violation: resolved to 2 elements',
        },
        'locator',
      ],
      [
        {
          errorName: 'Error',
          message: 'page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4000/',
        },
        'environment',
      ],
      [
        { errorName: 'AssertionError', message: 'Expected values to be strictly equal' },
        'assertion',
      ],
      [
        { errorName: 'TypeError', message: "Cannot read properties of undefined (reading 'id')" },
        'unclassified',
      ],
    ];
    for (const [evidence, expected] of cases) {
      assert.equal(classifyFailure(evidence).category, expected, evidence.message);
    }
  });

  it('recovers the framework code from the error class name after the run', () => {
    assert.equal(
      classifyFailure({
        errorName: 'ApiRequestError',
        message: 'GET /x returned HTTP 500; expected 200.',
      }).category,
      'environment',
    );
    assert.equal(classifyFailure({ errorName: 'LocatorError', message: 'x' }).category, 'locator');
  });

  it('ignores ANSI colour codes in messages', () => {
    const message = '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m).toBe(expected)';
    assert.equal(classifyFailure({ errorName: 'Error', message }).category, 'assertion');
  });

  it('prefers the framework code over message patterns', () => {
    const error = new TestDataError('Timed out after 5000 ms waiting for cleanup.');
    assert.equal(categoryOf(error), 'test-data');
  });

  it('timeouts from polling are reported as timeouts, not assertions', () => {
    const error = new ValidationError('Timed out after 2000 ms (4 attempts) waiting for item.');
    assert.equal(categoryOf(error), 'timeout');
  });

  it('returns catalogue metadata with every classification', () => {
    const result = classifyFailure({ errorName: 'TypeError', message: 'boom' });
    assert.deepEqual(
      { title: result.title, owner: result.owner, guidance: result.guidance },
      {
        title: FAILURE_CATEGORIES.unclassified.title,
        owner: FAILURE_CATEGORIES.unclassified.owner,
        guidance: FAILURE_CATEGORIES.unclassified.guidance,
      },
    );
  });

  it('describes every category', () => {
    for (const id of FAILURE_CATEGORY_IDS) {
      assert.equal(FAILURE_CATEGORIES[id].id, id);
      assert.ok(FAILURE_CATEGORIES[id].title.length > 0);
    }
  });
});

describe('evidenceFromError', () => {
  it('keeps the framework code and handles non-Error values', () => {
    assert.deepEqual(evidenceFromError(new LocatorError('missing')), {
      errorName: 'LocatorError',
      message: 'missing',
      errorCode: 'LOCATOR',
    });
    assert.deepEqual(evidenceFromError('plain string'), {
      errorName: 'NonErrorThrown',
      message: 'plain string',
    });
  });
});
