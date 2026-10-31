import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '@core/errors';
import { SchemaValidator, type ContractSchema } from '@interaction/api';

interface Member {
  id: string;
  email: string;
  visits: number;
  note?: string;
}

const memberSchema: ContractSchema<Member> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    visits: { type: 'integer', minimum: 0 },
    note: { type: 'string', nullable: true },
  },
  required: ['id', 'email', 'visits'],
  additionalProperties: false,
};

const VALID = {
  id: '6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b',
  email: 'synthetic@example.test',
  visits: 2,
};

describe('SchemaValidator', () => {
  const validator = new SchemaValidator();

  it('returns valid data typed by the contract', () => {
    const member = validator.validate(memberSchema, VALID, 'member');
    assert.equal(member.visits, 2);
    assert.deepEqual(validator.check(memberSchema, VALID), []);
  });

  it('reports every violation by location and rule', () => {
    const violations = validator.check(memberSchema, {
      id: 'not-a-uuid',
      email: 'synthetic@example.test',
      visits: -1,
      extra: true,
    });
    assert.deepEqual(violations, [
      { path: '', message: 'must NOT have additional properties (extra)' },
      { path: '/id', message: 'must match format "uuid"' },
      { path: '/visits', message: 'must be >= 0' },
    ]);
  });

  it('throws a ValidationError that names the contract but never echoes values', () => {
    const secretLooking = 'synthetic.private@example.test';
    assert.throws(
      () =>
        validator.validate(
          memberSchema,
          { ...VALID, email: 42, note: secretLooking, visits: 'x' },
          'member',
        ),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.message.startsWith(
          'Response does not match the member contract: /email must be string',
        ) &&
        !JSON.stringify({ message: error.message, context: error.context }).includes(secretLooking),
    );
  });

  it('reuses the compiled validator for the same schema object', () => {
    for (let run = 0; run < 3; run += 1) {
      assert.deepEqual(validator.check(memberSchema, VALID), []);
    }
  });
});
