import path from 'node:path';
import { ArtifactManager } from '@core/artifacts';
import { BrowserManager } from '@core/browser';
import { PROJECT_ROOT, type FrameworkConfig } from '@core/config';
import { ConsoleLogSink, ExecutionLogger, FileLogSink, type LogSink } from '@core/logging';
import { Redactor } from '@core/security';
import { AttemptTracker } from './attempt-tracker';

/** Services shared by all scenarios of one worker process. None of them hold scenario state. */
export interface WorkerRuntime {
  readonly config: FrameworkConfig;
  readonly logger: ExecutionLogger;
  readonly workerLogSinks: readonly LogSink[];
  readonly artifactManager: ArtifactManager;
  readonly browserManager: BrowserManager;
  readonly attempts: AttemptTracker;
}

export function createWorkerRuntime(config: FrameworkConfig): WorkerRuntime {
  const artifactManager = new ArtifactManager(
    path.resolve(PROJECT_ROOT, config.artifacts.outputDir),
  );
  const workerLogSinks: LogSink[] = [
    new FileLogSink(
      path.join(artifactManager.directory('logs'), `worker-${config.execution.workerId}.jsonl`),
    ),
    ...(config.logging.console ? [new ConsoleLogSink()] : []),
  ];
  const logger = new ExecutionLogger({
    level: config.logging.level,
    redactor: new Redactor(),
    sinks: workerLogSinks,
    context: {
      runId: config.runId,
      workerId: config.execution.workerId,
      environment: config.environment,
      browser: config.ui.browser,
    },
  });

  return {
    config,
    logger,
    workerLogSinks,
    artifactManager,
    browserManager: new BrowserManager(config.ui, logger.child({ component: 'browser' })),
    attempts: new AttemptTracker(),
  };
}

/** Non-sensitive summary of the run configuration for logs and report metadata. */
export function describeRun(config: FrameworkConfig): Record<string, unknown> {
  return {
    project: config.project.name,
    environment: config.environment,
    runId: config.runId,
    browser: config.ui.browser,
    device: config.ui.device ?? 'desktop',
    headless: config.ui.headless,
    locale: config.ui.locale,
    timezone: config.ui.timezoneId,
    uiHost: new URL(config.ui.baseUrl).host,
    apiHost: new URL(config.api.baseUrl).host,
    ci: config.execution.ci,
  };
}
