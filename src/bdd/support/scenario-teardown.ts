import { FrameworkError, serializeError } from '@core/errors';
import type { ExecutionLogger } from '@core/logging';

export interface TeardownStep {
  readonly name: string;
  readonly run: () => Promise<void>;
}

/**
 * Runs every teardown step in order even when earlier ones fail, logs each failure at error
 * level, and then rethrows: one failure as-is, several as a FrameworkError whose cause is an
 * AggregateError. A teardown failure therefore fails the scenario instead of disappearing.
 */
export async function runTeardown(
  steps: readonly TeardownStep[],
  logger: ExecutionLogger,
): Promise<void> {
  const failures: { name: string; error: unknown }[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error: unknown) {
      logger.error(`Teardown step failed: ${step.name}`, serializeError(error));
      failures.push({ name: step.name, error });
    }
  }
  const [first] = failures;
  if (first === undefined) {
    return;
  }
  if (failures.length === 1) {
    throw first.error;
  }
  throw new FrameworkError(
    `${failures.length} teardown steps failed: ${failures.map((failure) => failure.name).join(', ')}.`,
    {
      cause: new AggregateError(failures.map((failure) => failure.error)),
      context: { steps: failures.map((failure) => failure.name) },
    },
  );
}
