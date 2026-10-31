import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig, StaticEnvironmentSource } from '@core/config';
import { ConfigurationError, TestDataError, ValidationError } from '@core/errors';
import { UniqueIdGenerator } from '@core/test-data';
import { BookingRequestBuilder } from '@domains/appointments/builders/booking-request-builder';
import type { Appointment } from '@domains/appointments/models/appointment';
import {
  offsetFromLimit,
  requireAppointmentPolicy,
} from '@domains/appointments/policy/appointment-policy';
import { assertBookedAsRequested } from '@domains/appointments/validators/booked-appointment-validator';
import { ProviderBuilder } from '@domains/providers/builders/provider-builder';

const ids = () => new UniqueIdGenerator({ marker: 'TEST-', runId: 'unit', workerId: '0' });
const POLICY = {
  bookingHorizonDays: 30,
  cancellationCutoffHours: 24,
  reasonForVisitMaxLength: 200,
};
const MINUTE = 60_000;

describe('requireAppointmentPolicy', () => {
  it('returns the configured policy', () => {
    const config = loadConfig({ source: new StaticEnvironmentSource({ TEST_ENV: 'local' }) });
    assert.deepEqual(requireAppointmentPolicy(config), POLICY);
  });

  it('fails with a ConfigurationError instead of assuming rules', () => {
    const config = loadConfig({
      source: new StaticEnvironmentSource({
        UI_BASE_URL: 'https://ui.qa.example.test',
        API_BASE_URL: 'https://api.qa.example.test',
        AUTH_BASE_URL: 'https://auth.qa.example.test',
      }),
    });
    assert.throws(
      () => requireAppointmentPolicy(config),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('environment "qa"'),
    );
  });
});

describe('offsetFromLimit', () => {
  it('places times a margin inside or outside each limit', () => {
    const horizon = 30 * 24 * 60 * MINUTE;
    const cutoff = 24 * 60 * MINUTE;
    assert.equal(offsetFromLimit(POLICY, 'booking horizon', 'inside', 5), horizon - 5 * MINUTE);
    assert.equal(offsetFromLimit(POLICY, 'booking horizon', 'outside', 5), horizon + 5 * MINUTE);
    assert.equal(offsetFromLimit(POLICY, 'cancellation cutoff', 'inside', 5), cutoff - 5 * MINUTE);
    assert.equal(offsetFromLimit(POLICY, 'cancellation cutoff', 'outside', 5), cutoff + 5 * MINUTE);
  });

  it('rejects margins that are not positive whole minutes', () => {
    for (const margin of [0, -1, 1.5]) {
      assert.throws(
        () => offsetFromLimit(POLICY, 'booking horizon', 'inside', margin),
        TestDataError,
      );
    }
  });
});

describe('BookingRequestBuilder', () => {
  it('uses a marked synthetic reason by default', () => {
    const request = new BookingRequestBuilder(ids(), 'slot-1').build();
    assert.deepEqual(request, {
      slotId: 'slot-1',
      reasonForVisit: 'TEST-synthetic routine check-up',
    });
  });

  it('builds reasons of an exact length for boundary tests', () => {
    for (const length of [0, 1, 5, 6, 200, 201]) {
      const { reasonForVisit } = new BookingRequestBuilder(ids(), 's')
        .withReasonOfLength(length)
        .build();
      assert.equal(reasonForVisit.length, length);
    }
    assert.throws(
      () => new BookingRequestBuilder(ids(), 's').withReasonOfLength(-1),
      TestDataError,
    );
  });
});

describe('ProviderBuilder', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');

  it('builds a unique, marked provider with one default time three days ahead', () => {
    const generator = ids();
    const first = new ProviderBuilder(generator, () => now).build();
    const second = new ProviderBuilder(generator, () => now).build();
    assert.notEqual(first.name, second.name);
    assert.ok(first.name.startsWith('TEST-PROV-'));
    assert.ok(first.location.startsWith('TEST-'));
    assert.deepEqual(first.slots, [{ start: '2026-01-04T12:00:00.000Z', durationMinutes: 30 }]);
  });

  it('adds times relative to now, including past ones', () => {
    const { slots } = new ProviderBuilder(ids(), () => now)
      .withTimeStartingIn(-60 * MINUTE)
      .withTimeStartingIn(5 * MINUTE, 15)
      .build();
    assert.deepEqual(slots, [
      { start: '2026-01-01T11:00:00.000Z', durationMinutes: 30 },
      { start: '2026-01-01T12:05:00.000Z', durationMinutes: 15 },
    ]);
    assert.throws(() => new ProviderBuilder(ids()).withTimeStartingIn(Number.NaN), TestDataError);
  });
});

describe('assertBookedAsRequested', () => {
  const request = { slotId: 'slot-1', reasonForVisit: 'TEST-private reason ' };
  const booked: Appointment = {
    id: '00000000-0000-4000-8000-000000000001',
    reference: 'APT-1',
    providerId: 'p-1',
    providerName: 'TEST-PROV Synthetic Provider',
    specialty: 'Cardiology',
    location: 'TEST-Synthetic Clinic',
    start: '2026-01-04T12:00:00.000Z',
    durationMinutes: 30,
    status: 'booked',
    bookedAt: '2026-01-01T12:00:00.000Z',
    reasonForVisit: 'TEST-private reason',
  };
  const expected = {
    request,
    providerId: 'p-1',
    providerName: booked.providerName,
    start: '2026-01-04T12:00:00Z',
  };

  it('accepts what was requested, comparing instants and the trimmed reason', () => {
    assert.doesNotThrow(() => {
      assertBookedAsRequested(booked, expected);
    });
  });

  it('reports every discrepancy without echoing the reason for visit', () => {
    assert.throws(
      () => {
        assertBookedAsRequested(
          { ...booked, status: 'cancelled', reasonForVisit: 'TEST-other' },
          expected,
        );
      },
      (error: unknown) =>
        error instanceof ValidationError &&
        error.message.includes('status is "cancelled"') &&
        error.message.includes('reason for visit differs') &&
        !error.message.includes('TEST-other') &&
        !error.message.includes('TEST-private'),
    );
  });
});
