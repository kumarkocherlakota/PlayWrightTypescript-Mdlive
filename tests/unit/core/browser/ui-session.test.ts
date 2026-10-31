import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium, type Browser } from '@playwright/test';
import { ArtifactManager } from '@core/artifacts';
import { UiSession } from '@core/browser';
import { loadConfig, StaticEnvironmentSource, type ArtifactsConfig } from '@core/config';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { Redactor } from '@core/security';

const ORIGIN = 'http://ui-session.test';
const PAGE = `<!doctype html><html lang="en"><body><h1>Diagnostics</h1><script>
  fetch('/api/missing?token=synthetic-query-value');
  fetch('/api/broken');
</script></body></html>`;

describe('UiSession', () => {
  let browser: Browser;
  let artifactRoot: string;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    artifactRoot = await mkdtemp(path.join(tmpdir(), 'upaf-ui-session-'));
  });

  after(async () => {
    await browser.close();
    await rm(artifactRoot, { recursive: true, force: true });
  });

  async function openSession(policy: Partial<ArtifactsConfig>): Promise<UiSession> {
    const config = loadConfig({
      source: new StaticEnvironmentSource({
        UI_BASE_URL: ORIGIN,
        API_BASE_URL: 'https://api.qa.example.test',
        AUTH_BASE_URL: 'https://auth.qa.example.test',
      }),
    });
    const redactor = new Redactor();
    const session = await UiSession.open(browser, {
      ui: config.ui,
      artifactPolicy: { ...config.artifacts, video: 'off', trace: 'off', ...policy },
      artifacts: new ArtifactManager(artifactRoot).forScenario({
        name: 'ui session unit test',
        id: `pickle-${String(Date.now())}`,
        attempt: 1,
      }),
      logger: new ExecutionLogger({ level: 'debug', redactor, sinks: [new MemoryLogSink()] }),
      redactor,
    });
    await session.context.route('**/*', async (route) => {
      const { pathname } = new URL(route.request().url());
      const status = pathname === '/' ? 200 : pathname === '/api/broken' ? 500 : 404;
      await route.fulfill({
        status,
        contentType: pathname === '/' ? 'text/html; charset=utf-8' : 'text/plain',
        body: pathname === '/' ? PAGE : 'stub',
      });
    });
    return session;
  }

  it('records HTTP error responses without query strings', async () => {
    const session = await openSession({});
    const responses = Promise.all([
      session.page.waitForResponse('**/api/missing**'),
      session.page.waitForResponse('**/api/broken'),
    ]);
    await session.page.goto('/');
    await responses;

    const { httpErrors } = session.diagnostics();
    await session.close(false);

    assert.deepEqual([...httpErrors].sort(), [
      `GET ${ORIGIN}/api/broken -> 500`,
      `GET ${ORIGIN}/api/missing -> 404`,
    ]);
    assert.ok(httpErrors.every((entry) => !entry.includes('synthetic-query-value')));
  });

  it('keeps the trace only when the scenario failed under retain-on-failure', async () => {
    const passing = await openSession({ trace: 'retain-on-failure' });
    await passing.page.goto('/');
    assert.deepEqual(await passing.close(false), {});

    const failing = await openSession({ trace: 'retain-on-failure' });
    await failing.page.goto('/');
    const { tracePath } = await failing.close(true);
    assert.ok(tracePath !== undefined && existsSync(tracePath));
  });
});
