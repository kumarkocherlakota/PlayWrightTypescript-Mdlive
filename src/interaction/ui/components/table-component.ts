import { expect, type Locator } from '@playwright/test';
import { ValidationError } from '@core/errors';
import { BaseComponent } from '../base-component';
import type { UiContext } from '../ui-context';

export type TableRecord = Readonly<Record<string, string>>;

/** A data table read through its column headers, so callers never depend on column order. */
export class TableComponent extends BaseComponent {
  public constructor(root: Locator, ui: UiContext, description = 'table') {
    super(root, ui, description);
  }

  public async headers(): Promise<string[]> {
    const texts = await this.root.getByRole('columnheader').allInnerTexts();
    return texts.map((text) => text.trim());
  }

  public async rowCount(): Promise<number> {
    return this.dataRows().count();
  }

  public async waitForRowCount(count: number): Promise<void> {
    await this.perform(`show ${count} rows`, () =>
      expect(this.dataRows()).toHaveCount(count, { timeout: this.ui.expectTimeoutMs }),
    );
  }

  /** Reads every data row as a header → cell-text record. Empty header cells are skipped. */
  public async readRows(): Promise<TableRecord[]> {
    const headers = await this.headers();
    const rows = await this.dataRows().all();
    const records: TableRecord[] = [];
    for (const row of rows) {
      const cells = (await row.getByRole('cell').allInnerTexts()).map((text) => text.trim());
      if (cells.length !== headers.length) {
        throw new ValidationError(
          `${this.description} has a row with ${cells.length} cells but ${headers.length} headers.`,
          { context: { table: this.description, headers } },
        );
      }
      records.push(
        Object.fromEntries(
          headers.flatMap((header, index) => (header === '' ? [] : [[header, cells[index] ?? '']])),
        ),
      );
    }
    return records;
  }

  /** Clicks a button inside the single row containing `rowText`. */
  public async clickInRow(rowText: string, buttonName: string): Promise<void> {
    await this.perform(`click "${buttonName}" in the row "${rowText}"`, () =>
      this.dataRows()
        .filter({ hasText: rowText })
        .getByRole('button', { name: buttonName, exact: true })
        .click(),
    );
  }

  private dataRows(): Locator {
    return this.root.getByRole('row').filter({ has: this.ui.page.getByRole('cell') });
  }
}
