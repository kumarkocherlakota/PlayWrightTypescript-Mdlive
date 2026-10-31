/**
 * Appointment rules enforced by the reference app. The framework hands in the values from
 * `healthcare.appointmentPolicy` so the app and the tests share one source; the fixture default is
 * used only when the app runs on its own (`npm run reference-app`). None of these values describe
 * a real system (C-04, C-06, C-08).
 */
export interface ReferenceAppointmentPolicy {
  readonly bookingHorizonDays: number;
  readonly cancellationCutoffHours: number;
  readonly reasonForVisitMaxLength: number;
}

export const FIXTURE_APPOINTMENT_POLICY: ReferenceAppointmentPolicy = {
  bookingHorizonDays: 30,
  cancellationCutoffHours: 24,
  reasonForVisitMaxLength: 200,
};

/** Fixture specialties of the synthetic provider directory. */
export const SPECIALTIES = ['Cardiology', 'Dermatology', 'Family Medicine', 'Pediatrics'] as const;
