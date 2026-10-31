import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { FrameworkError } from '@core/errors';
import {
  AppointmentBookingWorkflow,
  AppointmentDashboardWorkflow,
  AppointmentServiceWorkflow,
  type AbandonedCancellation,
  type BookingSummary,
  type DashboardEntry,
  type PortalBookingOutcome,
  type PortalCancellationOutcome,
} from '@domains/appointments';
import type { Ordinal, ReasonLength } from '@bdd/support/parameter-types';
import type { CustomWorld } from '@bdd/world/custom-world';
import { policyOf, reasonLengthFor, slotOf } from './healthcare-state';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'appointments.summary': BookingSummary;
    'appointments.portalOutcome': PortalBookingOutcome;
    'appointments.portalReason': string;
    'appointments.chosenStart': string;
    'appointments.dashboardEntry': DashboardEntry | undefined;
    'appointments.cancellation': PortalCancellationOutcome;
    'appointments.abandoned': AbandonedCancellation;
  }
}

const booking = (world: CustomWorld): AppointmentBookingWorkflow =>
  new AppointmentBookingWorkflow(world.uiContext);
const dashboard = (world: CustomWorld): AppointmentDashboardWorkflow =>
  new AppointmentDashboardWorkflow(world.uiContext);

function syntheticReason(world: CustomWorld): string {
  return `${world.config.healthcare.syntheticDataMarker}synthetic portal booking`;
}

function reasonOfLength(world: CustomWorld, length: ReasonLength): string {
  const characters = reasonLengthFor(world, length);
  const marker = world.config.healthcare.syntheticDataMarker;
  return characters > marker.length ? marker.padEnd(characters, 'r') : 'r'.repeat(characters);
}

async function bookInPortal(world: CustomWorld, ordinal: Ordinal, reason: string): Promise<void> {
  const { provider } = world.state.get('healthcare.provider');
  const { start } = slotOf(world, ordinal);
  const { summary, outcome } = await booking(world).book(provider.name, start, reason);
  world.state.set('appointments.chosenStart', start);
  world.state.set('appointments.portalReason', reason);
  world.state.set('appointments.summary', summary);
  world.state.set('appointments.portalOutcome', outcome);
}

When(
  'the member books the {ordinal} time of that provider in the portal with a synthetic reason for visit',
  async function (this: CustomWorld, ordinal: Ordinal) {
    await bookInPortal(this, ordinal, syntheticReason(this));
  },
);

When(
  'the member books the {ordinal} time of that provider in the portal with a reason of {reasonLength}',
  async function (this: CustomWorld, ordinal: Ordinal, length: ReasonLength) {
    await bookInPortal(this, ordinal, reasonOfLength(this, length));
  },
);

Then('the booking summary showed that provider and time', function (this: CustomWorld) {
  const { provider } = this.state.get('healthcare.provider');
  expect(this.state.get('appointments.summary')).toEqual({
    provider: provider.name,
    specialty: provider.specialty,
    location: provider.location,
    start: this.state.get('appointments.chosenStart'),
  });
});

function confirmedBooking(world: CustomWorld): { reference: string; start: string } {
  const outcome = world.state.get('appointments.portalOutcome');
  if (!outcome.booked) {
    throw new FrameworkError(`The portal did not confirm the booking: ${outcome.message}`);
  }
  return outcome;
}

Then(
  'the portal confirms the booking with a reference for the chosen time',
  function (this: CustomWorld) {
    const confirmed = confirmedBooking(this);
    expect(confirmed.reference).not.toBe('');
    expect(confirmed.start).toBe(this.state.get('appointments.chosenStart'));
  },
);

Then(
  'the booking is refused with an error message associated with {string}',
  function (this: CustomWorld, field: string) {
    const outcome = this.state.get('appointments.portalOutcome');
    expect(outcome).toMatchObject({ booked: false, field });
    expect(outcome.booked ? '' : outcome.message).not.toBe('');
  },
);

Then(
  'the API returns the confirmed appointment with the chosen time and reason for visit',
  async function (this: CustomWorld) {
    const { reference } = confirmedBooking(this);
    const stored = await new AppointmentServiceWorkflow(this.apiContext).findByReference(reference);
    expect(stored).toMatchObject({
      status: 'booked',
      start: this.state.get('appointments.chosenStart'),
      reasonForVisit: this.state.get('appointments.portalReason'),
    });
  },
);

When('the member views that appointment on the dashboard', async function (this: CustomWorld) {
  const { reference } = this.state.get('healthcare.appointment');
  this.state.set('appointments.dashboardEntry', await dashboard(this).entry(reference));
});

Then(
  'the dashboard shows it as {string} with its provider, specialty and time',
  function (this: CustomWorld, status: string) {
    const appointment = this.state.get('healthcare.appointment');
    expect(this.state.get('appointments.dashboardEntry')).toEqual({
      reference: appointment.reference,
      provider: appointment.providerName,
      specialty: appointment.specialty,
      start: appointment.start,
      status,
      canBeCancelled: status === 'Booked',
    });
  },
);

Then(
  'the dashboard shows it as {string} without a cancel option',
  async function (this: CustomWorld, status: string) {
    const { reference } = this.state.get('healthcare.appointment');
    expect(await dashboard(this).entry(reference)).toMatchObject({ status, canBeCancelled: false });
  },
);

When('the member cancels that appointment on the dashboard', async function (this: CustomWorld) {
  const { reference } = this.state.get('healthcare.appointment');
  this.state.set('appointments.cancellation', await dashboard(this).cancel(reference));
});

Then('the dashboard announces that the appointment is cancelled', function (this: CustomWorld) {
  const { reference } = this.state.get('healthcare.appointment');
  expect(this.state.get('appointments.cancellation')).toEqual({
    cancelled: true,
    message: `Appointment ${reference} is cancelled.`,
  });
});

Then(
  'the dashboard explains that appointments inside the cancellation cutoff cannot be cancelled online',
  function (this: CustomWorld) {
    const hours = policyOf(this).cancellationCutoffHours;
    expect(this.state.get('appointments.cancellation')).toEqual({
      cancelled: false,
      message: `Appointments starting within ${hours} hours cannot be cancelled online.`,
    });
  },
);

When(
  'the member starts to cancel that appointment on the dashboard but keeps it',
  async function (this: CustomWorld) {
    const { reference } = this.state.get('healthcare.appointment');
    this.state.set('appointments.abandoned', await dashboard(this).startAndKeep(reference));
  },
);

Then(
  'the cancellation dialog titled {string} had keyboard focus',
  function (this: CustomWorld, title: string) {
    const abandoned = this.state.get('appointments.abandoned');
    expect({ title: abandoned.dialogTitle, focus: abandoned.focusWasInDialog }).toEqual({
      title,
      focus: true,
    });
  },
);

Then('the dashboard still shows it as {string}', function (this: CustomWorld, status: string) {
  expect(this.state.get('appointments.abandoned').entryAfterwards).toMatchObject({
    status,
    canBeCancelled: true,
  });
});

Given(
  'the member has chosen the {ordinal} time of that provider in the portal',
  async function (this: CustomWorld, ordinal: Ordinal) {
    const { provider } = this.state.get('healthcare.provider');
    const { start } = slotOf(this, ordinal);
    await booking(this).chooseTime(provider.name, start);
    this.state.set('appointments.chosenStart', start);
  },
);

Given('that time has meanwhile been booked through the API', async function (this: CustomWorld) {
  const { provider, slots } = this.state.get('healthcare.provider');
  const slot = slots.find((each) => each.start === this.state.get('appointments.chosenStart'));
  if (slot === undefined) {
    throw new FrameworkError('The chosen time is not one of the seeded times.');
  }
  await new AppointmentServiceWorkflow(this.apiContext).bookTime(provider, slot);
});

When(
  'the member confirms the booking with a synthetic reason for visit',
  async function (this: CustomWorld) {
    this.state.set(
      'appointments.portalOutcome',
      await booking(this).confirm(syntheticReason(this)),
    );
  },
);

Then('the booking page says {string}', function (this: CustomWorld, message: string) {
  expect(this.state.get('appointments.portalOutcome')).toEqual({
    booked: false,
    message,
    field: undefined,
  });
});
