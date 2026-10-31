import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  parallelCanAssignHelpers,
  setDefaultTimeout,
  setParallelCanAssign,
  Status,
} from '@cucumber/cucumber';
import { UiSession } from '@core/browser';
import { getConfig } from '@core/config';
import { serializeError } from '@core/errors';
import { ApiSession } from '@interaction/api';
import { finalizeApiSession } from '@bdd/support/api-session-finalizer';
import { reportScenarioFailure } from '@bdd/support/failure-reporter';
import { createScenarioRuntime } from '@bdd/support/scenario-runtime-factory';
import { runTeardown } from '@bdd/support/scenario-teardown';
import { finalizeUiSession } from '@bdd/support/ui-session-finalizer';
import { createWorkerRuntime, describeRun } from '@bdd/support/worker-runtime';
import type { CustomWorld } from '@bdd/world/custom-world';

// Loading configuration at import time fails fast before any scenario starts.
const worker = createWorkerRuntime(getConfig());

setDefaultTimeout(worker.config.execution.stepTimeoutMs);
// Scenarios tagged @serial never run concurrently with each other (ADR-008).
setParallelCanAssign(parallelCanAssignHelpers.atMostOnePicklePerTag(['@serial']));

BeforeAll({ name: 'Start worker' }, function () {
  worker.logger.info('Worker started', describeRun(worker.config));
});

Before({ name: 'Initialize scenario runtime' }, function (this: CustomWorld, hook) {
  this.initialize(createScenarioRuntime(worker, hook));
  this.logger.info('Scenario started', {
    feature: this.scenario.feature,
    tags: this.scenario.tags,
    uri: this.scenario.uri,
  });
});

Before({ name: 'Open UI session', tags: '@ui' }, async function (this: CustomWorld) {
  const browser = await worker.browserManager.getBrowser();
  this.attachUiSession(
    await UiSession.open(browser, {
      ui: this.config.ui,
      artifactPolicy: this.config.artifacts,
      artifacts: this.artifacts,
      logger: this.logger.child({ component: 'ui-session' }),
      redactor: this.redactor,
    }),
  );
});

Before(
  { name: 'Open API session', tags: '@api or @integration' },
  async function (this: CustomWorld) {
    this.attachApiSession(
      await ApiSession.open({
        api: this.config.api,
        auth: this.config.auth,
        logger: this.logger.child({ component: 'api-session' }),
        redactor: this.redactor,
        secrets: this.secrets,
        correlationId: this.scenario.correlationId,
        validator: worker.schemaValidator,
      }),
    );
  },
);

// A single After hook keeps teardown order explicit: test-data cleanup (needs the API session),
// API evidence, UI evidence, then logs. Every step runs even if an earlier one fails.
After({ name: 'Finalize scenario' }, async function (this: CustomWorld, hook) {
  const status = hook.result?.status ?? Status.UNKNOWN;
  const failed = status === Status.FAILED;
  try {
    await runTeardown(
      [
        {
          name: 'test-data cleanup',
          run: () => this.cleanup.runAllOrThrow().then(() => undefined),
        },
        { name: 'API session', run: () => finalizeApiSession(this, failed) },
        { name: 'UI session', run: () => finalizeUiSession(this, failed) },
      ],
      this.logger,
    );
  } finally {
    const classification = reportScenarioFailure(this, status, hook.error);
    this.logger.info('Scenario finished', {
      status,
      attempt: this.scenario.attempt,
      ...(classification === undefined ? {} : { failureCategory: classification.category }),
      ...(failed && hook.error !== undefined ? { error: serializeError(hook.error) } : {}),
    });
    this.attach(this.logBuffer.toJsonLines(), {
      mediaType: 'text/plain',
      fileName: 'scenario-log.jsonl',
    });
  }
});

AfterAll({ name: 'Stop worker' }, async function () {
  await worker.browserManager.close();
  worker.logger.info('Worker finished');
});
