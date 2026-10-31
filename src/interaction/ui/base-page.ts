import type { Page } from '@playwright/test';
import { NavigationError } from '@core/errors';
import type { UiContext } from './ui-context';

/**
 * Minimal page contract (RULE-005): where the page lives and how to know it is ready.
 * Page behavior is composed from components; multi-page processes belong in workflows.
 */
export abstract class BasePage {
  /** Path relative to `ui.baseUrl`, e.g. "/appointments". */
  protected abstract readonly path: string;
  /** Business-readable page name used in logs and errors. */
  public abstract readonly name: string;

  protected constructor(protected readonly ui: UiContext) {}

  protected get page(): Page {
    return this.ui.page;
  }

  /** Resolves only when the page shows its ready state (a web-first check, never a sleep). */
  public abstract waitUntilReady(): Promise<void>;

  public async open(): Promise<void> {
    this.ui.logger.info(`Opening ${this.name}`, { path: this.path });
    const response = await this.page.goto(this.path).catch((error: unknown) => {
      throw new NavigationError(`Could not open ${this.name} at ${this.path}.`, {
        cause: error,
        context: { page: this.name, path: this.path },
      });
    });
    if (response !== null && !response.ok()) {
      throw new NavigationError(`${this.name} responded with HTTP ${response.status()}.`, {
        context: { page: this.name, path: this.path, status: response.status() },
      });
    }
    await this.waitUntilReady();
  }

  /** For pages reached through in-app navigation rather than `open()`. */
  public async waitUntilLoaded(): Promise<void> {
    await this.page
      .waitForURL((url) => url.pathname === this.path)
      .catch((error: unknown) => {
        throw new NavigationError(`Expected to arrive at ${this.name} (${this.path}).`, {
          cause: error,
          context: { page: this.name, path: this.path },
        });
      });
    await this.waitUntilReady();
  }
}
