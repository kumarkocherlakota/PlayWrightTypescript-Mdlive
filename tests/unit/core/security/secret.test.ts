import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inspect } from 'node:util';
import { StaticEnvironmentSource } from '@core/config';
import { ConfigurationError } from '@core/errors';
import { EnvironmentSecretProvider, MASK, Redactor, Secret } from '@core/security';

describe('Secret', () => {
  const secret = new Secret('TEST_USER_PASSWORD', 'synthetic-value');

  it('reveals the value only explicitly', () => {
    assert.equal(secret.reveal(), 'synthetic-value');
  });

  it('masks string conversion, JSON and inspection', () => {
    assert.equal(String(secret), MASK);
    assert.equal(JSON.stringify({ secret }), `{"secret":"${MASK}"}`);
    assert.ok(!inspect(secret).includes('synthetic-value'));
  });
});

describe('EnvironmentSecretProvider', () => {
  it('returns secrets and registers them for redaction', () => {
    const redactor = new Redactor();
    const provider = new EnvironmentSecretProvider(
      new StaticEnvironmentSource({ TEST_USER_PASSWORD: 'synthetic-pass-1' }),
      redactor,
    );
    assert.equal(provider.require('TEST_USER_PASSWORD').reveal(), 'synthetic-pass-1');
    assert.equal(redactor.redactText('value synthetic-pass-1'), `value ${MASK}`);
  });

  it('fails with the missing variable name and never includes a value', () => {
    const provider = new EnvironmentSecretProvider(new StaticEnvironmentSource({}), new Redactor());
    assert.throws(
      () => provider.require('TEST_USER_EMAIL'),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('TEST_USER_EMAIL'),
    );
    assert.equal(provider.find('TEST_USER_EMAIL'), undefined);
  });
});
