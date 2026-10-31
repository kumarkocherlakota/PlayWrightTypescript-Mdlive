import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { Redactor } from '@core/security';
import type { UiContext } from '@interaction/ui';

/** Fictitious origin; every request to it is answered by `serve()` stubs, never by the network. */
export const FIXTURE_ORIGIN = 'http://ui-fixture.test';

export interface StubResponse {
  readonly status?: number;
  readonly contentType?: string;
  readonly body: string;
}

/** A fresh browser context whose requests are served from in-memory stubs. */
export interface BrowserFixture {
  readonly page: Page;
  readonly ui: UiContext;
  readonly logs: MemoryLogSink;
  serve(path: string, response: StubResponse): void;
  /** Serves `html` at `/` and navigates there, so relative URLs and `fetch` work. */
  show(html: string): Promise<void>;
  close(): Promise<void>;
}

export function launchFixtureBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function openBrowserFixture(
  browser: Browser,
  expectTimeoutMs = 1_000,
): Promise<BrowserFixture> {
  const context: BrowserContext = await browser.newContext({ baseURL: FIXTURE_ORIGIN });
  context.setDefaultTimeout(expectTimeoutMs);
  // Navigation is fixture setup, not the behaviour under test; short test timeouts must not apply.
  context.setDefaultNavigationTimeout(10_000);
  const stubs = new Map<string, StubResponse>();
  await context.route('**/*', async (route) => {
    const stub = stubs.get(new URL(route.request().url()).pathname);
    await route.fulfill(
      stub === undefined
        ? { status: 404, contentType: 'text/plain', body: 'no stub' }
        : {
            status: stub.status ?? 200,
            contentType: stub.contentType ?? 'text/html; charset=utf-8',
            body: stub.body,
          },
    );
  });
  const page = await context.newPage();
  const logs = new MemoryLogSink();
  const logger = new ExecutionLogger({ level: 'debug', redactor: new Redactor(), sinks: [logs] });

  return {
    page,
    ui: { page, logger, expectTimeoutMs },
    logs,
    serve: (path, response) => {
      stubs.set(path, response);
    },
    show: async (html) => {
      stubs.set('/', { body: `<!doctype html><html lang="en"><body>${html}</body></html>` });
      await page.goto('/');
    },
    close: () => context.close(),
  };
}
