/**
 * Public contract of the appointments domain: booking, viewing and cancelling appointments of
 * the synthetic member over the API and in the patient portal, and the configured appointment
 * policy those processes depend on (RULE-018).
 */
export {
  APPOINTMENT_STATUSES,
  type AbandonedCancellation,
  type Appointment,
  type AppointmentStatus,
  type BookingRequest,
  type BookingSummary,
  type DashboardEntry,
  type PortalBookingOutcome,
  type PortalCancellationOutcome,
} from './models/appointment';
export {
  LIMIT_SIDES,
  POLICY_LIMITS,
  offsetFromLimit,
  requireAppointmentPolicy,
  type LimitSide,
  type PolicyLimit,
} from './policy/appointment-policy';
export type { BookingRequestBuilder } from './builders/booking-request-builder';
export { AppointmentBookingWorkflow } from './workflows/appointment-booking-workflow';
export { AppointmentDashboardWorkflow } from './workflows/appointment-dashboard-workflow';
export { AppointmentServiceWorkflow } from './workflows/appointment-service-workflow';
