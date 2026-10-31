import { randomUUID } from 'node:crypto';
import type { ITestCaseHookParameter } from '@cucumber/cucumber';
import { ProcessEnvironmentSource } from '@core/config';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { EnvironmentSecretProvider, Redactor } from '@core/security';
import type { ScenarioInfo, ScenarioRuntime } from '@bdd/world/scenario-runtime';
import type { WorkerRuntime } from './worker-runtime';

/**
 * Builds fresh per-scenario services. The redactor is scenario-scoped so secrets revealed in one
 * scenario are tracked without sharing mutable state across scenarios.
 */
export function createScenarioRuntime(
  worker: WorkerRuntime,
  hook: ITestCaseHookParameter,
): ScenarioRuntime {
  const { config } = worker;
  const scenario = describeScenario(hook, worker.attempts.next(hook.pickle.id));
  const redactor = new Redactor();
  const logBuffer = new MemoryLogSink();

  const logger = new ExecutionLogger({
    level: config.logging.level,
    redactor,
    sinks: [logBuffer, ...worker.workerLogSinks],
    context: {
      runId: config.runId,
      workerId: config.execution.workerId,
      environment: config.environment,
      browser: config.ui.browser,
      scenario: scenario.name,
      attempt: scenario.attempt,
      correlationId: scenario.correlationId,
    },
  });

  return {
    config,
    scenario,
    logger,
    logBuffer,
    redactor,
    secrets: new EnvironmentSecretProvider(new ProcessEnvironmentSource(), redactor),
    artifacts: worker.artifactManager.forScenario(scenario),
  };
}

function describeScenario(hook: ITestCaseHookParameter, attempt: number): ScenarioInfo {
  return {
    id: hook.pickle.id,
    name: hook.pickle.name,
    feature: hook.gherkinDocument.feature?.name ?? 'Unnamed feature',
    uri: hook.pickle.uri,
    tags: hook.pickle.tags.map((tag) => tag.name),
    attempt,
    correlationId: randomUUID(),
  };
}
