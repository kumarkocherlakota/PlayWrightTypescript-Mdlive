export const APPOINTMENT_STATUSES = ['booked', 'cancelled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** An appointment as returned by the appointments API. Times are ISO 8601 instants (UTC). */
export interface Appointment {
  readonly id: string;
  /** Member-facing reference shown in the portal, e.g. on the confirmation. */
  readonly reference: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly specialty: string;
  readonly location: string;
  readonly start: string;
  readonly durationMinutes: number;
  readonly status: AppointmentStatus;
  readonly bookedAt: string;
  readonly cancelledAt?: string;
  /** Present only in the detail view; lists omit it (minimum necessary). */
  readonly reasonForVisit?: string;
}

export interface BookingRequest {
  readonly slotId: string;
  readonly reasonForVisit: string;
}

/** One row of the member's dashboard, as the member sees it. */
export interface DashboardEntry {
  readonly reference: string;
  readonly provider: string;
  readonly specialty: string;
  /** ISO instant from the row's `<time datetime>`; the visible text is localized. */
  readonly start: string;
  /** Status as displayed, e.g. "Booked". */
  readonly status: string;
  readonly canBeCancelled: boolean;
}

/** What the booking page showed after the member submitted a booking. */
export type PortalBookingOutcome =
  | { readonly booked: true; readonly reference: string; readonly start: string }
  | {
      readonly booked: false;
      readonly message: string;
      /** The field the message is attached to, when it is a field error. */
      readonly field: 'Reason for visit' | undefined;
    };

export interface PortalCancellationOutcome {
  readonly cancelled: boolean;
  readonly message: string;
}

/** What the booking page summarizes before the member confirms. */
export interface BookingSummary {
  readonly provider: string;
  readonly specialty: string;
  readonly location: string;
  readonly start: string;
}

export interface AbandonedCancellation {
  readonly dialogTitle: string;
  readonly focusWasInDialog: boolean;
  readonly entryAfterwards: DashboardEntry | undefined;
}
