import type { UiContext } from '@interaction/ui';
import { ProviderSearchWorkflow } from '@domains/providers';
import type { BookingSummary, PortalBookingOutcome } from '../models/appointment';
import { BookingPage } from '../pages/booking-page';

/**
 * Booking in the patient portal across pages: find the provider, choose a time, give a reason
 * for visit and confirm.
 */
export class AppointmentBookingWorkflow {
  private readonly search: ProviderSearchWorkflow;
  private readonly booking: BookingPage;

  public constructor(ui: UiContext) {
    this.search = new ProviderSearchWorkflow(ui);
    this.booking = new BookingPage(ui);
  }

  /** Chooses the time and returns what the booking page summarizes, without booking. */
  public async chooseTime(providerName: string, isoStart: string): Promise<BookingSummary> {
    await this.search.chooseTime(providerName, isoStart);
    await this.booking.waitUntilLoaded();
    return this.booking.summary();
  }

  /** Books the time chosen earlier with `chooseTime`. */
  public confirm(reasonForVisit: string): Promise<PortalBookingOutcome> {
    return this.booking.book(reasonForVisit);
  }

  public async book(
    providerName: string,
    isoStart: string,
    reasonForVisit: string,
  ): Promise<{ summary: BookingSummary; outcome: PortalBookingOutcome }> {
    const summary = await this.chooseTime(providerName, isoStart);
    return { summary, outcome: await this.booking.book(reasonForVisit) };
  }
}
