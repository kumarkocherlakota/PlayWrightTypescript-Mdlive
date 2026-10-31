import type { Locator } from '@playwright/test';
import { ValidationError } from '@core/errors';
import { BasePage, FormComponent, uiActionFailed, type UiContext } from '@interaction/ui';
import { readDescriptionList } from '../components/description-list';
import type { BookingSummary, PortalBookingOutcome } from '../models/appointment';

const REASON = 'Reason for visit';

/** "Book an appointment" page: summary of the chosen time, reason for visit, confirmation. */
export class BookingPage extends BasePage {
  public readonly name = 'Booking page';
  protected readonly path = '/portal/book';
  private readonly form: FormComponent;

  public constructor(ui: UiContext) {
    super(ui);
    this.form = new FormComponent(
      this.page.getByRole('form', { name: 'Book appointment' }),
      ui,
      'booking form',
    );
  }

  public async waitUntilReady(): Promise<void> {
    await this.waitForAny([this.summaryRegion(), this.alert()], 'show the chosen time');
  }

  public async summary(): Promise<BookingSummary> {
    const details = await readDescriptionList(this.summaryRegion());
    return {
      provider: details.Provider ?? '',
      specialty: details.Specialty ?? '',
      location: details.Location ?? '',
      start: details['Date and time'] ?? '',
    };
  }

  /** Submits the reason and waits for the confirmation, an error or a field error. */
  public async book(reasonForVisit: string): Promise<PortalBookingOutcome> {
    await this.form.fill(REASON, reasonForVisit);
    await this.form.submit('Book appointment');
    await this.waitForAny(
      [this.confirmation(), this.alert(), this.invalidReason()],
      'show the booking outcome',
    );
    if (await this.confirmation().isVisible()) {
      const details = await readDescriptionList(this.confirmation());
      return {
        booked: true,
        reference: details.Reference ?? '',
        start: details['Date and time'] ?? '',
      };
    }
    if (await this.form.isInvalid(REASON)) {
      return {
        booked: false,
        message: await this.form.validationMessageFor(REASON),
        field: REASON,
      };
    }
    return { booked: false, message: (await this.alert().innerText()).trim(), field: undefined };
  }

  private async waitForAny(candidates: readonly Locator[], action: string): Promise<void> {
    const [first, ...rest] = candidates;
    if (first === undefined) {
      throw new ValidationError('No outcome locators were given.');
    }
    const anyOf = rest.reduce((union, candidate) => union.or(candidate), first);
    await anyOf
      .filter({ visible: true })
      .waitFor({ state: 'visible', timeout: this.ui.expectTimeoutMs })
      .catch((error: unknown) => {
        throw uiActionFailed(this.name, action, error);
      });
  }

  private summaryRegion(): Locator {
    return this.page.getByRole('region', { name: 'Appointment details' });
  }

  private confirmation(): Locator {
    return this.page.getByRole('region', { name: 'Appointment booked' });
  }

  private alert(): Locator {
    return this.page.getByRole('alert');
  }

  /** ARIA state selector: getByRole has no aria-invalid filter (locator priority 6, ADR-005). */
  private invalidReason(): Locator {
    return this.page
      .getByLabel(REASON, { exact: true })
      .and(this.page.locator('[aria-invalid="true"]'));
  }
}
