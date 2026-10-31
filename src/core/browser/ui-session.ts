import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { ArtifactPolicy, ArtifactsConfig, UiConfig } from '@core/config';
import type { ScenarioArtifacts } from '@core/artifacts';
import type { ExecutionLogger } from '@core/logging';
import type { Redactor } from '@core/security';
import { buildContextOptions } from './context-options';

export interface UiSessionOptions {
  readonly ui: UiConfig;
  readonly artifactPolicy: ArtifactsConfig;
  readonly artifacts: ScenarioArtifacts;
  readonly logger: ExecutionLogger;
  readonly redactor: Redactor;
}

export interface UiSessionDiagnostics {
  readonly url: string;
  readonly consoleErrors: readonly string[];
  readonly failedRequests: readonly string[];
}

export interface UiSessionArtifacts {
  readonly tracePath?: string;
  readonly videoPath?: string;
}

export interface StorageSummary {
  readonly cookies: number;
  readonly originsWithStorage: number;
  readonly url: string;
}

const MAX_DIAGNOSTIC_ENTRIES = 50;

/** One isolated BrowserContext + Page for exactly one scenario attempt (ADR-004). */
export class UiSession {
  private readonly consoleErrors: string[] = [];
  private readonly failedRequests: string[] = [];

  private constructor(
    public readonly context: BrowserContext,
    public readonly page: Page,
    private readonly options: UiSessionOptions,
  ) {
    this.observe();
  }

  public static async open(browser: Browser, options: UiSessionOptions): Promise<UiSession> {
    const { ui, artifactPolicy, artifacts } = options;
    const videoDirectory =
      artifactPolicy.video === 'off' ? undefined : artifacts.directoryFor('videos');
    const context = await browser.newContext(buildContextOptions(ui, videoDirectory));
    context.setDefaultTimeout(ui.actionTimeoutMs);
    context.setDefaultNavigationTimeout(ui.navigationTimeoutMs);
    if (artifactPolicy.trace !== 'off') {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    }
    const page = await context.newPage();
    options.logger.debug('UI session opened', { browser: browser.browserType().name() });
    return new UiSession(context, page, options);
  }

  public diagnostics(): UiSessionDiagnostics {
    return {
      url: this.safeUrl(this.page.url()),
      consoleErrors: [...this.consoleErrors],
      failedRequests: [...this.failedRequests],
    };
  }

  public async storageSummary(): Promise<StorageSummary> {
    const state = await this.context.storageState();
    return {
      cookies: state.cookies.length,
      originsWithStorage: state.origins.filter((origin) => origin.localStorage.length > 0).length,
      url: this.page.url(),
    };
  }

  public async captureScreenshot(): Promise<{ path: string; image: Buffer }> {
    const screenshotPath = this.options.artifacts.pathFor('screenshots', 'png');
    const image = await this.page.screenshot({ path: screenshotPath, fullPage: true });
    return { path: screenshotPath, image };
  }

  /** Stops tracing, closes the context and keeps or discards artifacts per policy. */
  public async close(failed: boolean): Promise<UiSessionArtifacts> {
    const { artifactPolicy, artifacts } = this.options;
    const keepTrace = shouldKeep(artifactPolicy.trace, failed);
    const keepVideo = shouldKeep(artifactPolicy.video, failed);
    const tracePath = keepTrace ? artifacts.pathFor('traces', 'zip') : undefined;
    const video = this.page.video();

    try {
      if (artifactPolicy.trace !== 'off') {
        await this.context.tracing.stop(tracePath === undefined ? {} : { path: tracePath });
      }
    } finally {
      await this.context.close();
    }

    const videoPath = video === null ? undefined : await video.path();
    if (videoPath !== undefined && !keepVideo) {
      // Videos are written to a per-scenario directory, so the whole directory is discarded.
      await rm(path.dirname(videoPath), { recursive: true, force: true });
    }
    return {
      ...(tracePath === undefined ? {} : { tracePath }),
      ...(videoPath !== undefined && keepVideo ? { videoPath } : {}),
    };
  }

  private observe(): void {
    this.page.on('console', (message) => {
      if (message.type() === 'error') {
        this.record(this.consoleErrors, this.options.redactor.redactText(message.text()));
      }
    });
    this.page.on('pageerror', (error) => {
      this.record(this.consoleErrors, this.options.redactor.redactText(error.message));
    });
    this.page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'unknown';
      this.record(
        this.failedRequests,
        `${request.method()} ${this.safeUrl(request.url())} (${reason})`,
      );
    });
  }

  private record(target: string[], entry: string): void {
    if (target.length < MAX_DIAGNOSTIC_ENTRIES) {
      target.push(entry);
    }
  }

  /** Query strings, fragments and data: payloads may carry tokens or PHI; never record them. */
  private safeUrl(raw: string): string {
    if (!URL.canParse(raw)) {
      return '[unparseable-url]';
    }
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `${url.origin}${url.pathname}`;
    }
    return url.protocol === 'about:' ? `about:${url.pathname}` : url.protocol;
  }
}

function shouldKeep(policy: ArtifactPolicy, failed: boolean): boolean {
  return policy === 'on' || (policy === 'retain-on-failure' && failed);
}
