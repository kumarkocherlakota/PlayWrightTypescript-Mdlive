import type { ScenarioArtifacts } from '@core/artifacts';
import type { FrameworkConfig } from '@core/config';
import type { ExecutionLogger, MemoryLogSink } from '@core/logging';
import type { Redactor, SecretProvider } from '@core/security';
import type { CleanupRegistry, UniqueIdGenerator } from '@core/test-data';

export interface ScenarioInfo {
  /** Cucumber pickle id; identical across retries of the same scenario. */
  readonly id: string;
  readonly name: string;
  readonly feature: string;
  readonly uri: string;
  readonly tags: readonly string[];
  /** 1 for the first run, incremented on each retry. */
  readonly attempt: number;
  readonly correlationId: string;
}

/** Per-scenario services composed by the hooks and handed to the World. */
export interface ScenarioRuntime {
  readonly config: FrameworkConfig;
  readonly scenario: ScenarioInfo;
  readonly logger: ExecutionLogger;
  readonly logBuffer: MemoryLogSink;
  readonly redactor: Redactor;
  readonly secrets: SecretProvider;
  readonly artifacts: ScenarioArtifacts;
  readonly ids: UniqueIdGenerator;
  readonly cleanup: CleanupRegistry;
}
