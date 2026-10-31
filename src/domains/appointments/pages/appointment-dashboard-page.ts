import type { Locator } from '@playwright/test';
import {
  BasePage,
  DialogComponent,
  NotificationComponent,
  uiActionFailed,
  type UiContext,
} from '@interaction/ui';
import { AppointmentListComponent } from '../components/appointment-list-component';
import type { PortalCancellationOutcome } from '../models/appointment';

/** "My appointments" dashboard of the patient portal, with cancellation. */
export class AppointmentDashboardPage extends BasePage {
  public readonly name = 'Appointment dashboard';
  protected readonly path = '/portal/dashboard';
  public readonly appointments: AppointmentListComponent;
  public readonly cancelDialog: DialogComponent;
  private readonly status: NotificationComponent;

  public constructor(ui: UiContext) {
    super(ui);
    this.appointments = new AppointmentListComponent(
      this.page.getByRole('table', { name: 'My appointments' }),
      ui,
    );
    this.cancelDialog = new DialogComponent(
      this.page.getByRole('dialog', { name: 'Cancel appointment?' }),
      ui,
      'cancel appointment dialog',
    );
    this.status = new NotificationComponent(this.page.getByRole('status'), ui, 'dashboard status');
  }

  public async waitUntilReady(): Promise<void> {
    await this.page
      .getByRole('table', { name: 'My appointments' })
      .or(this.page.getByText('You have no appointments.', { exact: true }))
      .or(this.alert())
      .filter({ visible: true })
      .waitFor({ state: 'visible', timeout: this.ui.expectTimeoutMs })
      .catch((error: unknown) => {
        throw uiActionFailed(this.name, 'show the appointments', error);
      });
  }

  /** Confirms the cancellation in the open dialog and waits for the announced outcome. */
  public async confirmCancellation(reference: string): Promise<PortalCancellationOutcome> {
    await this.cancelDialog.close('Confirm cancellation');
    const done = `Appointment ${reference} is cancelled.`;
    await this.page
      .getByRole('status')
      .filter({ hasText: done })
      .or(this.alert())
      .filter({ visible: true })
      .waitFor({ state: 'visible', timeout: this.ui.expectTimeoutMs })
      .catch((error: unknown) => {
        throw uiActionFailed(this.name, `announce the cancellation of ${reference}`, error);
      });
    if (await this.alert().isVisible()) {
      return { cancelled: false, message: (await this.alert().innerText()).trim() };
    }
    return { cancelled: true, message: await this.status.message() };
  }

  private alert(): Locator {
    return this.page.getByRole('alert');
  }
}
