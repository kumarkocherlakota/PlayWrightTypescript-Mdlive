import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '@bdd/world/custom-world';
import type { RequestKind } from './healthcare-state';

/**
 * One assertion for every healthcare request that may legitimately be rejected, so scenario
 * outlines can mix accepted, invalid-field and refused outcomes in one Examples table.
 */
Then(
  /^the (directory|appointment list|booking|cancellation) request is (?:accepted|rejected because "([^"]+)" is invalid|refused with status (\d+) and error "([^"]+)")$/,
  function (
    this: CustomWorld,
    kind: RequestKind,
    // Cucumber passes unmatched optional groups as null.
    invalidField: string | null,
    status: string | null,
    error: string | null,
  ) {
    const recorded = this.state.get('healthcare.outcome');
    expect(recorded.kind).toBe(kind);
    const { outcome } = recorded;
    if (invalidField !== null) {
      expect(outcome).toMatchObject({ accepted: false, status: 400, error: 'validation_failed' });
      expect(outcome.accepted ? [] : outcome.invalidFields).toContain(invalidField);
    } else if (status !== null) {
      expect(outcome).toMatchObject({ accepted: false, status: Number(status), error });
    } else {
      expect(outcome).toMatchObject({ accepted: true });
    }
  },
);
