import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '../base-component';
import type { UiContext } from '../ui-context';

/** A live region (`role="status"` or `role="alert"`) that announces outcomes to users. */
export class NotificationComponent extends BaseComponent {
  public constructor(root: Locator, ui: UiContext, description = 'notification') {
    super(root, ui, description);
  }

  /**
   * Waits for the announcement and returns its text. Strings and patterns are both compared with
   * the trimmed text, so an anchored pattern such as `/^\d+ results found$/` tolerates the
   * surrounding whitespace that `toHaveText` ignores only for strings.
   */
  public async waitForMessage(expected: string | RegExp): Promise<string> {
    const timeout = this.ui.expectTimeoutMs;
    await this.perform(`announce ${String(expected)}`, () =>
      typeof expected === 'string'
        ? expect(this.root).toHaveText(expected, { timeout })
        : expect.poll(() => this.message(), { timeout }).toMatch(expected),
    );
    return this.message();
  }

  public async message(): Promise<string> {
    return (await this.root.innerText()).trim();
  }
}
