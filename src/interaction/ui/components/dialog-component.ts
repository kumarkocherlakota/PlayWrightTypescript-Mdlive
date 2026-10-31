import type { Locator } from '@playwright/test';
import { BaseComponent } from '../base-component';
import type { UiContext } from '../ui-context';

/** A modal dialog (`role="dialog"`), including the focus behavior users rely on. */
export class DialogComponent extends BaseComponent {
  public constructor(root: Locator, ui: UiContext, description = 'dialog') {
    super(root, ui, description);
  }

  public async title(): Promise<string> {
    return this.perform('read its title', async () =>
      (await this.root.getByRole('heading').innerText()).trim(),
    );
  }

  /** True when keyboard focus is inside the dialog (WCAG 2.4.3 focus order). */
  public async containsFocus(): Promise<boolean> {
    return this.perform('report focus', () =>
      this.root.evaluate((element) => element.contains(element.ownerDocument.activeElement)),
    );
  }

  public async close(buttonName = 'Close'): Promise<void> {
    await this.perform(`close with "${buttonName}"`, () =>
      this.root.getByRole('button', { name: buttonName, exact: true }).click(),
    );
    await this.waitUntilHidden();
  }

  public async closeWithEscape(): Promise<void> {
    await this.perform('close with Escape', () => this.root.press('Escape'));
    await this.waitUntilHidden();
  }
}
