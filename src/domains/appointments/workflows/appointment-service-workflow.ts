import { ValidationError } from '@core/errors';
import type { ApiContext } from '@interaction/api';
import type { RequestOutcome } from '@domains/shared-kernel';
import type { Provider, Slot } from '@domains/providers';
import { AppointmentClient } from '../api/appointment-client';
import { BookingRequestBuilder } from '../builders/booking-request-builder';
import type { Appointment, BookingRequest } from '../models/appointment';
import { assertBookedAsRequested } from '../validators/booked-appointment-validator';

/**
 * Appointment processes over the API for the signed-in synthetic member. Appointments are booked
 * only on scenario-owned providers, whose cleanup also removes the appointments.
 */
export class AppointmentServiceWorkflow {
  public constructor(private readonly api: ApiContext) {}

  public newBookingRequest(slotId: string): BookingRequestBuilder {
    return new BookingRequestBuilder(this.api.ids, slotId);
  }

  /** Books the time and verifies the service booked exactly what was requested. */
  public async bookTime(
    provider: Provider,
    slot: Slot,
    request: BookingRequest = this.newBookingRequest(slot.id).build(),
  ): Promise<Appointment> {
    const appointment = await this.client().book(request);
    assertBookedAsRequested(appointment, {
      request,
      providerId: provider.id,
      providerName: provider.name,
      start: slot.start,
    });
    return appointment;
  }

  /** Submits a payload that may be rejected. */
  public attemptToBook(payload: unknown): Promise<RequestOutcome<Appointment>> {
    return this.client().attemptBook(payload);
  }

  public myAppointments(): Promise<readonly Appointment[]> {
    return this.client().list();
  }

  /** The member's appointment with this reference, from their list; undefined when absent. */
  public async findByReference(reference: string): Promise<Appointment | undefined> {
    const listed = (await this.myAppointments()).find((each) => each.reference === reference);
    return listed === undefined ? undefined : this.client().find(listed.id);
  }

  public find(id: string): Promise<Appointment | undefined> {
    return this.client().find(id);
  }

  public async cancel(id: string): Promise<Appointment> {
    const outcome = await this.attemptToCancel(id);
    if (!outcome.accepted) {
      throw new ValidationError(`Appointment ${id} could not be cancelled: ${outcome.error}.`, {
        context: { appointmentId: id, status: outcome.status, error: outcome.error },
      });
    }
    return outcome.value;
  }

  public attemptToCancel(id: string): Promise<RequestOutcome<Appointment>> {
    return this.client().attemptCancel(id);
  }

  private client(): AppointmentClient {
    return new AppointmentClient(this.api.session.client(), this.api.session.validator);
  }
}
