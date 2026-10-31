import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ApiRequestError,
  AuthenticationError,
  ConfigurationError,
  FrameworkError,
  LocatorError,
  NavigationError,
  serializeError,
  TestDataError,
  ValidationError,
} from '@core/errors';

describe('FrameworkError hierarchy', () => {
  const cases = [
    [ConfigurationError, 'CONFIGURATION'],
    [NavigationError, 'NAVIGATION'],
    [AuthenticationError, 'AUTHENTICATION'],
    [ApiRequestError, 'API_REQUEST'],
    [LocatorError, 'LOCATOR'],
    [TestDataError, 'TEST_DATA'],
    [ValidationError, 'VALIDATION'],
  ] as const;

  for (const [ErrorType, code] of cases) {
    it(`${ErrorType.name} has code ${code} and extends FrameworkError`, () => {
      const error = new ErrorType('message');
      assert.ok(error instanceof FrameworkError);
      assert.equal(error.code, code);
      assert.equal(error.name, ErrorType.name);
    });
  }

  it('keeps cause and frozen context', () => {
    const cause = new Error('root');
    const error = new ApiRequestError('wrapped', { cause, context: { status: 500 } });
    assert.equal(error.cause, cause);
    assert.ok(Object.isFrozen(error.context));
  });

  it('serializes nested causes and non-error values', () => {
    const serialized = serializeError(
      new FrameworkError('outer', { cause: new Error('inner'), context: { a: 1 } }),
    );
    assert.equal(serialized.code, 'FRAMEWORK');
    assert.equal(serialized.cause?.message, 'inner');
    assert.deepEqual(serializeError('plain'), { name: 'NonErrorThrown', message: 'plain' });
  });
});
