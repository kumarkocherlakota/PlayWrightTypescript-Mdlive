import type { Envelope } from '@cucumber/messages';
import { collectAttempts, type AttemptStatus } from '../failure-analysis/scenario-attempts';
import { astNodeLines, pickleLocation } from './collect-scenarios';

export interface ExecutionResult {
  /** Status of the final attempt. */
  readonly status: AttemptStatus;
  readonly attempts: number;
  /** Failed at least once, then passed on retry. */
  readonly flaky: boolean;
}

export interface RunResults {
  /** When the run started, from the messages stream; undefined if it was not recorded. */
  readonly startedAt: string | undefined;
  readonly byLocation: ReadonlyMap<string, ExecutionResult>;
}

/**
 * Execution results of one recorded Cucumber run, keyed by scenario location so they can be
 * joined with scenarios parsed separately (pickle IDs differ between parses).
 */
export function resultsFromRun(envelopes: readonly Envelope[]): RunResults {
  const lines = new Map<string, number>();
  const locations = new Map<string, string>();
  let startedAt: string | undefined;
  for (const envelope of envelopes) {
    if (envelope.gherkinDocument) {
      for (const [id, line] of astNodeLines(envelope.gherkinDocument)) {
        lines.set(`${envelope.gherkinDocument.uri ?? ''}#${id}`, line);
      }
    } else if (envelope.pickle) {
      const { id, uri, astNodeIds } = envelope.pickle;
      const scoped = new Map(
        astNodeIds.map((nodeId) => [nodeId, lines.get(`${uri}#${nodeId}`) ?? 0]),
      );
      locations.set(id, pickleLocation(uri, astNodeIds, scoped));
    } else if (envelope.testRunStarted) {
      const { seconds } = envelope.testRunStarted.timestamp;
      startedAt = new Date(seconds * 1_000).toISOString();
    }
  }

  const attemptsByLocation = new Map<string, AttemptStatus[]>();
  for (const attempt of collectAttempts(envelopes)) {
    const location = locations.get(attempt.pickleId);
    if (location !== undefined) {
      attemptsByLocation.set(location, [
        ...(attemptsByLocation.get(location) ?? []),
        attempt.status,
      ]);
    }
  }
  const byLocation = new Map<string, ExecutionResult>();
  for (const [location, statuses] of attemptsByLocation) {
    const status = statuses.at(-1) ?? 'unknown';
    byLocation.set(location, {
      status,
      attempts: statuses.length,
      flaky: status === 'passed' && statuses.includes('failed'),
    });
  }
  return { startedAt, byLocation };
}
