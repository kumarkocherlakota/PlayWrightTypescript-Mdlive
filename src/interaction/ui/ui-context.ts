import type { Page } from '@playwright/test';
import type { ExecutionLogger } from '@core/logging';

/** Everything a page, component or UI workflow needs; built once per scenario by the World. */
export interface UiContext {
  readonly page: Page;
  readonly logger: ExecutionLogger;
  /** Timeout for web-first assertions (`ui.expectTimeoutMs`). */
  readonly expectTimeoutMs: number;
}
