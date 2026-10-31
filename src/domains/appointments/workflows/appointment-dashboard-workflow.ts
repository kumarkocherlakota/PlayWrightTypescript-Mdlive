import type { UiContext } from '@interaction/ui';
import type {
  AbandonedCancellation,
  DashboardEntry,
  PortalCancellationOutcome,
} from '../models/appointment';
import { AppointmentDashboardPage } from '../pages/appointment-dashboard-page';

/** Viewing and cancelling appointments on the member's dashboard. */
export class AppointmentDashboardWorkflow {
  private readonly dashboard: AppointmentDashboardPage;

  public constructor(ui: UiContext) {
    this.dashboard = new AppointmentDashboardPage(ui);
  }

  /** Resolves when the browser has arrived at the dashboard, e.g. after signing in. */
  public async waitUntilShown(): Promise<void> {
    await this.dashboard.waitUntilLoaded();
  }

  /** Opens the dashboard fresh and returns the row of this appointment, if shown. */
  public async entry(reference: string): Promise<DashboardEntry | undefined> {
    await this.dashboard.open();
    return this.dashboard.appointments.entry(reference);
  }

  public async cancel(reference: string): Promise<PortalCancellationOutcome> {
    await this.dashboard.open();
    await this.dashboard.appointments.startCancellation(reference);
    await this.dashboard.cancelDialog.waitUntilVisible();
    const outcome = await this.dashboard.confirmCancellation(reference);
    if (outcome.cancelled) {
      await this.dashboard.appointments.waitForStatus(reference, 'Cancelled');
    }
    return outcome;
  }

  /** Starts a cancellation, then keeps the appointment. */
  public async startAndKeep(reference: string): Promise<AbandonedCancellation> {
    await this.dashboard.open();
    await this.dashboard.appointments.startCancellation(reference);
    await this.dashboard.cancelDialog.waitUntilVisible();
    const dialogTitle = await this.dashboard.cancelDialog.title();
    const focusWasInDialog = await this.dashboard.cancelDialog.containsFocus();
    await this.dashboard.cancelDialog.close('Keep appointment');
    return {
      dialogTitle,
      focusWasInDialog,
      entryAfterwards: await this.dashboard.appointments.entry(reference),
    };
  }
}
