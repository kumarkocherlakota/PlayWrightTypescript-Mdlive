import {
  chromium,
  firefox,
  selectors,
  webkit,
  type Browser,
  type BrowserType,
} from '@playwright/test';
import type { BrowserName, UiConfig } from '@core/config';
import { FrameworkError } from '@core/errors';
import type { ExecutionLogger } from '@core/logging';

const BROWSER_TYPES: Readonly<Record<BrowserName, BrowserType>> = { chromium, firefox, webkit };

/**
 * Owns the single Browser of a worker process (ADR-004). The browser is launched lazily on the
 * first UI scenario and relaunched if it disconnects, so API-only runs never start a browser.
 */
export class BrowserManager {
  private browser: Browser | undefined;
  private launching: Promise<Browser> | undefined;

  public constructor(
    private readonly ui: UiConfig,
    private readonly logger: ExecutionLogger,
  ) {}

  public async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected() === true) {
      return this.browser;
    }
    this.launching ??= this.launch().finally(() => {
      this.launching = undefined;
    });
    this.browser = await this.launching;
    return this.browser;
  }

  public async close(): Promise<void> {
    const browser = this.browser;
    this.browser = undefined;
    if (browser?.isConnected() === true) {
      await browser.close();
      this.logger.info('Browser closed');
    }
  }

  private async launch(): Promise<Browser> {
    const { browser: name, headless, slowMoMs, channel } = this.ui;
    selectors.setTestIdAttribute(this.ui.testIdAttribute);
    try {
      const browser = await BROWSER_TYPES[name].launch({
        headless,
        slowMo: slowMoMs,
        ...(channel === undefined ? {} : { channel }),
      });
      this.logger.info('Browser launched', { browser: name, version: browser.version(), headless });
      return browser;
    } catch (error) {
      throw new FrameworkError(
        `Failed to launch ${name}. Run "npx playwright install ${name}" if binaries are missing.`,
        { cause: error, context: { browser: name, ...(channel === undefined ? {} : { channel }) } },
      );
    }
  }
}
