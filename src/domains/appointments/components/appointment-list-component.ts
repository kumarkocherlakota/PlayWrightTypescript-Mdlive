import { expect, type Locator } from '@playwright/test';
import { BaseComponent, TableComponent, type UiContext } from '@interaction/ui';
import type { DashboardEntry } from '../models/appointment';

const CANCEL = 'Cancel appointment';

/**
 * The "My appointments" table. Rows are addressed by appointment reference, which is unique, so
 * the component works while parallel scenarios add rows for the same synthetic member.
 */
export class AppointmentListComponent extends BaseComponent {
  private readonly table: TableComponent;

  public constructor(root: Locator, ui: UiContext) {
    super(root, ui, 'appointment list');
    this.table = new TableComponent(root, ui, 'appointment list');
  }

  public async entry(reference: string): Promise<DashboardEntry | undefined> {
    const record = (await this.table.readRows()).find((row) => row.Reference === reference);
    if (record === undefined) {
      return undefined;
    }
    const row = this.row(reference);
    const start = await row.locator('time').getAttribute('datetime');
    return {
      reference,
      provider: record.Provider ?? '',
      specialty: record.Specialty ?? '',
      start: new Date(start ?? '').toISOString(),
      status: record.Status ?? '',
      canBeCancelled: (await row.getByRole('button', { name: CANCEL, exact: true }).count()) > 0,
    };
  }

  public async startCancellation(reference: string): Promise<void> {
    await this.table.clickInRow(reference, CANCEL);
  }

  public async waitForStatus(reference: string, status: string): Promise<void> {
    await this.perform(`show ${reference} as ${status}`, () =>
      expect(this.row(reference).getByRole('cell', { name: status, exact: true })).toBeVisible({
        timeout: this.ui.expectTimeoutMs,
      }),
    );
  }

  /** `<time>` has no ARIA role, so the row's time is read by element name. */
  private row(reference: string): Locator {
    return this.root.getByRole('row').filter({ hasText: reference });
  }
}
