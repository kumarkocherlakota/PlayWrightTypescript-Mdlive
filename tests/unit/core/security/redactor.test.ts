import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MASK, Redactor, Secret } from '@core/security';
import { syntheticSensitiveValue } from '@core/test-data';

describe('Redactor', () => {
  const redactor = new Redactor();

  it('masks sensitive keys regardless of casing or separators', () => {
    const result = redactor.redact({
      Password: 'x',
      access_token: 'y',
      'Set-Cookie': 'z',
      headers: { Authorization: 'Bearer abc' },
    });
    assert.deepEqual(result, {
      Password: MASK,
      access_token: MASK,
      'Set-Cookie': MASK,
      headers: { Authorization: MASK },
    });
  });

  it('masks healthcare identifiers and demographics', () => {
    const result = redactor.redact({
      memberId: 'M1',
      dateOfBirth: '1990-01-01',
      mrn: '123',
      firstName: 'Ada',
      diagnosisCode: 'Z00',
      reasonForVisit: 'synthetic follow-up',
      reason_for_visit: 'synthetic follow-up',
      symptoms: 'synthetic',
    });
    assert.ok(Object.values(result as Record<string, unknown>).every((value) => value === MASK));
  });

  it('keeps non-sensitive business fields readable', () => {
    const result = redactor.redact({ providerName: 'Clinic', specialty: 'Cardiology', count: 3 });
    assert.deepEqual(result, { providerName: 'Clinic', specialty: 'Cardiology', count: 3 });
  });

  it('masks sensitive patterns in free text', () => {
    const email = syntheticSensitiveValue('email address');
    const card = syntheticSensitiveValue('card number');
    const text = redactor.redactText(
      `user ${email} paid with ${card}; Authorization: Bearer abc_def-123 ?token=xyz&page=2 ssn 123-45-6789`,
    );
    assert.ok(!text.includes(email));
    assert.ok(!text.includes(card));
    assert.ok(!text.includes('abc_def-123'));
    assert.ok(!text.includes('xyz'));
    assert.ok(!text.includes('123-45-6789'));
    assert.ok(text.includes('Bearer ***'));
    assert.ok(text.includes('page=2'));
  });

  it('masks JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl';
    assert.equal(redactor.redactText(`token ${jwt}`), `token ${MASK}`);
  });

  it('does not mask long numbers that fail the Luhn check', () => {
    assert.equal(redactor.redactText('epoch 1761900000000'), 'epoch 1761900000000');
  });

  it('masks registered secret values anywhere in text', () => {
    const scoped = new Redactor();
    scoped.registerSensitiveValue('plain-value-42');
    assert.equal(scoped.redactText('echo plain-value-42 done'), `echo ${MASK} done`);
  });

  it('masks Secret instances, handles cycles, and does not mutate input', () => {
    const input: Record<string, unknown> = { secretless: new Secret('X', 'v'), note: 'ok' };
    input.self = input;
    const result = redactor.redact(input) as Record<string, unknown>;
    assert.equal(result.secretless, MASK);
    assert.equal(result.self, '[Circular]');
    assert.ok(input.secretless instanceof Secret);
  });

  it('serializes and redacts errors', () => {
    const result = redactor.redact(new Error('failed for password=hunter22')) as Record<
      string,
      unknown
    >;
    assert.equal(result.message, `failed for password=${MASK}`);
  });
});
