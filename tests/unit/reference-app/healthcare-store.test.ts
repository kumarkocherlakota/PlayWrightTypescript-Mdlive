import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HealthcareStore } from '../../../reference-app/healthcare/healthcare-store';
import { HttpProblem } from '../../../reference-app/routing';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const POLICY = {
  bookingHorizonDays: 30,
  cancellationCutoffHours: 24,
  reasonForVisitMaxLength: 200,
};

function storeWithSlots(offsetsMs: readonly number[]) {
  const store = new HealthcareStore(POLICY, () => NOW);
  const { provider, slots } = store.addProvider(
    {
      name: 'TEST-PROV Synthetic',
      specialty: 'Cardiology',
      location: 'TEST-Clinic',
      seededBy: 'owner',
    },
    offsetsMs.map((offset) => ({
      start: new Date(NOW + offset).toISOString(),
      durationMinutes: 30,
    })),
  );
  return { store, provider, slotIds: slots.map((slot) => slot.id) };
}

function problemOf(action: () => unknown): { status: number; error: unknown } {
  try {
    action();
  } catch (error) {
    if (error instanceof HttpProblem) {
      return { status: error.status, error: error.body.error };
    }
    throw error;
  }
  throw new Error('Expected an HttpProblem.');
}

describe('HealthcareStore booking rules (fixture rules of the reference app)', () => {
  it('books a future time inside the horizon and marks it unavailable', () => {
    const { store, provider, slotIds } = storeWithSlots([48 * HOUR, 72 * HOUR]);
    const appointment = store.book('member', slotIds[0] ?? '', 'TEST-reason');
    assert.match(appointment.reference, /^APT-[0-9A-F]{8}$/);
    assert.deepEqual(
      store.upcomingSlots(provider.id).map((slot) => slot.available),
      [false, true],
    );
  });

  it('refuses unknown, past, beyond-horizon and already booked times', () => {
    const { store, slotIds } = storeWithSlots([-HOUR, 30 * 24 * HOUR + 5 * 60_000, 48 * HOUR]);
    const [past, beyond, open] = slotIds.map((id) => id);
    assert.deepEqual(
      problemOf(() => store.book('m', 'missing', 'r')),
      { status: 404, error: 'slot_not_found' },
    );
    assert.deepEqual(
      problemOf(() => store.book('m', past ?? '', 'r')),
      { status: 422, error: 'slot_in_past' },
    );
    assert.deepEqual(
      problemOf(() => store.book('m', beyond ?? '', 'r')),
      {
        status: 422,
        error: 'beyond_booking_horizon',
      },
    );
    store.book('m', open ?? '', 'r');
    assert.deepEqual(
      problemOf(() => store.book('other', open ?? '', 'r')),
      {
        status: 409,
        error: 'slot_unavailable',
      },
    );
  });

  it('enforces the cancellation cutoff and refuses a second cancellation', () => {
    const { store, slotIds } = storeWithSlots([24 * HOUR - 5 * 60_000, 24 * HOUR + 5 * 60_000]);
    const late = store.book('m', slotIds[0] ?? '', 'r');
    const early = store.book('m', slotIds[1] ?? '', 'r');
    assert.deepEqual(
      problemOf(() => store.cancel('m', late.id)),
      {
        status: 422,
        error: 'cancellation_window_closed',
      },
    );
    assert.equal(store.cancel('m', early.id).status, 'cancelled');
    assert.deepEqual(
      problemOf(() => store.cancel('m', early.id)),
      { status: 409, error: 'already_cancelled' },
    );
  });

  it("never discloses another member's appointment", () => {
    const { store, slotIds } = storeWithSlots([48 * HOUR]);
    const appointment = store.book('owner-member', slotIds[0] ?? '', 'r');
    assert.equal(store.appointmentOf('someone-else', appointment.id), undefined);
    assert.deepEqual(store.appointmentsOf('someone-else'), []);
    assert.deepEqual(
      problemOf(() => store.cancel('someone-else', appointment.id)),
      {
        status: 404,
        error: 'not_found',
      },
    );
  });

  it('includes the reason for visit only in the detail view', () => {
    const { store, slotIds } = storeWithSlots([48 * HOUR]);
    const appointment = store.book('m', slotIds[0] ?? '', 'TEST-reason');
    assert.equal(store.view(appointment, true).reasonForVisit, 'TEST-reason');
    assert.equal('reasonForVisit' in store.view(appointment, false), false);
  });

  it('lets only the seeding caller remove a provider, with its times and appointments', () => {
    const { store, provider, slotIds } = storeWithSlots([48 * HOUR]);
    store.book('m', slotIds[0] ?? '', 'r');
    assert.equal(store.removeSeededProvider(provider.id, 'intruder'), false);
    assert.equal(store.removeSeededProvider(provider.id, 'owner'), true);
    assert.equal(store.provider(provider.id), undefined);
    assert.deepEqual(store.appointmentsOf('m'), []);
  });
});
