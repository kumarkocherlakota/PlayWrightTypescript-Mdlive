import { randomBytes, randomUUID } from 'node:crypto';
import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import {
  AppointmentServiceWorkflow,
  type Appointment,
  type AppointmentStatus,
} from '@domains/appointments';
import type { Ordinal, ReasonLength } from '@bdd/support/parameter-types';
import type { CustomWorld } from '@bdd/world/custom-world';
import { reasonLengthFor, recordOutcome, slotOf } from './healthcare-state';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'appointments.submittedReason': string;
    'appointments.listed': readonly Appointment[];
    'appointments.lookup': Appointment | undefined;
  }
}

const service = (world: CustomWorld): AppointmentServiceWorkflow =>
  new AppointmentServiceWorkflow(world.apiContext);

async function bookThroughApi(world: CustomWorld, ordinal: Ordinal): Promise<void> {
  const { provider } = world.state.get('healthcare.provider');
  const appointment = await service(world).bookTime(provider, slotOf(world, ordinal));
  world.state.set('healthcare.appointment', appointment);
}

async function attemptBooking(world: CustomWorld, reasonForVisit: string): Promise<void> {
  const payload = service(world)
    .newBookingRequest(slotOf(world, 'first').id)
    .withReason(reasonForVisit)
    .build();
  world.state.set('appointments.submittedReason', reasonForVisit);
  recordOutcome(world, 'booking', await service(world).attemptToBook(payload));
}

Given(
  'the {ordinal} time of that provider has been booked through the API',
  async function (this: CustomWorld, ordinal: Ordinal) {
    await bookThroughApi(this, ordinal);
  },
);

When(
  'the member books the {ordinal} time of that provider through the API',
  async function (this: CustomWorld, ordinal: Ordinal) {
    await bookThroughApi(this, ordinal);
  },
);

Then('the appointment is booked as requested', function (this: CustomWorld) {
  const { provider, slots } = this.state.get('healthcare.provider');
  expect(this.state.get('healthcare.appointment')).toMatchObject({
    providerId: provider.id,
    start: slots[0]?.start,
    status: 'booked',
  });
});

Then(
  'the appointment can be retrieved with its reason for visit',
  async function (this: CustomWorld) {
    const booked = this.state.get('healthcare.appointment');
    const retrieved = await service(this).find(booked.id);
    expect(retrieved).toEqual(booked);
    expect(retrieved?.reasonForVisit).toBeTruthy();
  },
);

When(
  'the member tries to book that time again through the API',
  async function (this: CustomWorld) {
    const payload = service(this).newBookingRequest(slotOf(this, 'first').id).build();
    recordOutcome(this, 'booking', await service(this).attemptToBook(payload));
  },
);

When(
  'the member tries to book that time through the API with a reason of {reasonLength}',
  async function (this: CustomWorld, length: ReasonLength) {
    const payload = service(this)
      .newBookingRequest(slotOf(this, 'first').id)
      .withReasonOfLength(reasonLengthFor(this, length))
      .build();
    recordOutcome(this, 'booking', await service(this).attemptToBook(payload));
  },
);

When(
  'the member tries to book that time through the API with a synthetic reason for visit',
  async function (this: CustomWorld) {
    await attemptBooking(this, `${this.apiContext.ids.marker}synthetic follow-up`);
  },
);

When(
  'the member tries to book that time through the API with a distinctive synthetic reason for visit',
  async function (this: CustomWorld) {
    const marker = this.apiContext.ids.marker;
    await attemptBooking(this, `${marker}distinctive-${randomBytes(6).toString('hex')}`);
  },
);

Then('the execution log does not contain that reason for visit', function (this: CustomWorld) {
  const reason = this.state.get('appointments.submittedReason');
  expect(this.logBuffer.toJsonLines()).not.toContain(reason);
});

Given('that appointment has been cancelled through the API', async function (this: CustomWorld) {
  const appointment = this.state.get('healthcare.appointment');
  this.state.set('healthcare.appointment', await service(this).cancel(appointment.id));
});

When(
  'the member tries to cancel that appointment through the API',
  async function (this: CustomWorld) {
    const appointment = this.state.get('healthcare.appointment');
    recordOutcome(this, 'cancellation', await service(this).attemptToCancel(appointment.id));
  },
);

Then(
  'the API reports that appointment as {appointmentStatus}',
  async function (this: CustomWorld, status: AppointmentStatus) {
    const appointment = this.state.get('healthcare.appointment');
    expect((await service(this).find(appointment.id))?.status).toBe(status);
  },
);

When('the member lists their appointments through the API', async function (this: CustomWorld) {
  this.state.set('appointments.listed', await service(this).myAppointments());
});

Then('the listed appointment does not include the reason for visit', function (this: CustomWorld) {
  const { id } = this.state.get('healthcare.appointment');
  const listed = this.state.get('appointments.listed').find((each) => each.id === id);
  expect(listed).toBeDefined();
  expect(listed).not.toHaveProperty('reasonForVisit');
});

When(
  'the member requests an appointment with an identifier that is not theirs',
  async function (this: CustomWorld) {
    this.state.set('appointments.lookup', await service(this).find(randomUUID()));
  },
);

Then('the appointment is reported as not found', function (this: CustomWorld) {
  expect(this.state.get('appointments.lookup')).toBeUndefined();
});
