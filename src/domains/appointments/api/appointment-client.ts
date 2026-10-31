import type { ApiResponse, HttpClient, SchemaValidator } from '@interaction/api';
import { rejectionFrom, type RequestOutcome } from '@domains/shared-kernel';
import type { Appointment, BookingRequest } from '../models/appointment';
import {
  appointmentListSchema,
  appointmentSchema,
  listedAppointmentSchema,
} from '../schemas/appointment-schemas';

const APPOINTMENTS = '/appointments';

/** Typed client for the appointments API of the signed-in member. */
export class AppointmentClient {
  public constructor(
    private readonly http: HttpClient,
    private readonly validator: SchemaValidator,
  ) {}

  public async book(request: BookingRequest): Promise<Appointment> {
    const response = await this.http.post(APPOINTMENTS, { json: request, expectedStatus: 201 });
    return this.detail(response);
  }

  /** Submits any payload, including deliberately invalid ones. */
  public async attemptBook(payload: unknown): Promise<RequestOutcome<Appointment>> {
    const response = await this.http.post(APPOINTMENTS, { json: payload });
    return response.status === 201
      ? { accepted: true, status: 201, value: this.detail(response) }
      : rejectionFrom(response, this.validator);
  }

  public async list(): Promise<readonly Appointment[]> {
    const response = await this.http.get(APPOINTMENTS, { expectedStatus: 200 });
    return this.validator.validate(appointmentListSchema, response.body, 'appointment list')
      .appointments;
  }

  /** Returns the appointment, or undefined when the service reports it does not exist. */
  public async find(id: string): Promise<Appointment | undefined> {
    const response = await this.http.get(appointmentPath(id), { expectedStatus: [200, 404] });
    return response.status === 404 ? undefined : this.detail(response);
  }

  public async attemptCancel(id: string): Promise<RequestOutcome<Appointment>> {
    const response = await this.http.post(`${appointmentPath(id)}/cancellation`);
    return response.status === 200
      ? {
          accepted: true,
          status: 200,
          value: this.validator.validate(listedAppointmentSchema, response.body, 'appointment'),
        }
      : rejectionFrom(response, this.validator);
  }

  private detail(response: ApiResponse): Appointment {
    return this.validator.validate(appointmentSchema, response.body, 'appointment');
  }
}

function appointmentPath(id: string): string {
  return `${APPOINTMENTS}/${encodeURIComponent(id)}`;
}
