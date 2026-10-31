import { expect, type Locator } from '@playwright/test';
import { uiActionFailed } from './ui-action-error';
import type { UiContext } from './ui-context';

/**
 * Contract for reusable UI components. Every child locator is scoped to `root`, so the same
 * component works inside lists, tables and dialogs. Kept intentionally small (RULE-005).
 */
export abstract class BaseComponent {
  protected constructor(
    protected readonly root: Locator,
    protected readonly ui: UiContext,
    /** Business-readable name used in logs and errors, e.g. "search results table". */
    public readonly description: string,
  ) {}

  public async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }

  public async waitUntilVisible(): Promise<void> {
    await this.perform('become visible', () =>
      expect(this.root).toBeVisible({ timeout: this.ui.expectTimeoutMs }),
    );
  }

  public async waitUntilHidden(): Promise<void> {
    await this.perform('become hidden', () =>
      expect(this.root).toBeHidden({ timeout: this.ui.expectTimeoutMs }),
    );
  }

  /** Runs a UI operation with structured logging and a business-level error on failure. */
  protected async perform<T>(action: string, operation: () => Promise<T>): Promise<T> {
    this.ui.logger.debug(`${this.description}: ${action}`);
    try {
      return await operation();
    } catch (error) {
      throw uiActionFailed(this.description, action, error);
    }
  }
}
