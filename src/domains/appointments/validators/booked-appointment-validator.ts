import { ValidationError } from '@core/errors';
import type { Appointment, BookingRequest } from '../models/appointment';

export interface BookingExpectation {
  readonly request: BookingRequest;
  readonly providerId: string;
  readonly providerName: string;
  /** ISO start of the booked time. */
  readonly start: string;
}

/**
 * Business check that the service booked what was requested: the chosen provider and time, the
 * trimmed reason for visit, and status "booked". Reports every discrepancy at once. Field values
 * are not echoed in the error, because the reason for visit is health information.
 */
export function assertBookedAsRequested(
  appointment: Appointment,
  expected: BookingExpectation,
): void {
  const problems: string[] = [];
  if (appointment.status !== 'booked') {
    problems.push(`status is "${appointment.status}" instead of "booked"`);
  }
  if (appointment.providerId !== expected.providerId) {
    problems.push('the provider differs from the one chosen');
  }
  if (appointment.providerName !== expected.providerName) {
    problems.push('the provider name differs from the one chosen');
  }
  if (Date.parse(appointment.start) !== Date.parse(expected.start)) {
    problems.push(`start ${appointment.start} differs from the chosen time ${expected.start}`);
  }
  if (appointment.reasonForVisit !== expected.request.reasonForVisit.trim()) {
    problems.push('the stored reason for visit differs from the one submitted');
  }
  if (problems.length > 0) {
    throw new ValidationError(
      `Appointment ${appointment.reference} was not booked as requested: ${problems.join('; ')}.`,
      { context: { appointmentId: appointment.id, problems } },
    );
  }
}
