import { serializeError, TestDataError, type SerializedError } from '@core/errors';
import type { ExecutionLogger } from '@core/logging';

export interface CleanupFailure {
  readonly description: string;
  readonly error: SerializedError;
}

export interface CleanupReport {
  readonly succeeded: readonly string[];
  readonly failed: readonly CleanupFailure[];
}

interface CleanupAction {
  readonly description: string;
  readonly run: () => Promise<void>;
}

/**
 * Per-scenario list of actions that undo test-data setup (ADR-006). Actions run in reverse
 * registration order, so data created last (which may depend on earlier data) is removed first.
 * Every action runs even when an earlier one fails; each failure is logged at error level and
 * returned in the report so the caller can attach it and fail the scenario.
 */
export class CleanupRegistry {
  private actions: CleanupAction[] = [];

  public constructor(private readonly logger: ExecutionLogger) {}

  public get size(): number {
    return this.actions.length;
  }

  /** Registers an action, described in business terms, e.g. "delete inventory item TEST-…". */
  public register(description: string, run: () => Promise<void>): void {
    this.actions.push({ description, run });
  }

  /** Runs and removes all registered actions; safe to call more than once. */
  public async runAll(): Promise<CleanupReport> {
    const pending = this.actions.reverse();
    this.actions = [];
    const succeeded: string[] = [];
    const failed: CleanupFailure[] = [];
    for (const action of pending) {
      try {
        await action.run();
        succeeded.push(action.description);
      } catch (error: unknown) {
        const failure = { description: action.description, error: serializeError(error) };
        this.logger.error(`Cleanup failed: ${action.description}`, failure.error);
        failed.push(failure);
      }
    }
    if (succeeded.length > 0) {
      this.logger.info('Test data cleaned up', { actions: succeeded });
    }
    return { succeeded, failed };
  }

  /** Like `runAll`, but throws a TestDataError naming every failed action (ADR-006). */
  public async runAllOrThrow(): Promise<CleanupReport> {
    const report = await this.runAll();
    if (report.failed.length > 0) {
      throw new TestDataError(
        `Test-data cleanup failed for ${report.failed.length} action(s): ${report.failed
          .map((failure) => failure.description)
          .join('; ')}. Remove the data manually if it remains.`,
        { context: { failed: report.failed } },
      );
    }
    return report;
  }
}
