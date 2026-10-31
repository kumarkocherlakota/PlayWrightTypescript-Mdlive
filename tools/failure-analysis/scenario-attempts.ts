/**
 * Rebuilds one record per scenario attempt from a Cucumber messages stream (NDJSON). Only the
 * fields needed for failure analysis are read; attachments are ignored entirely.
 */
import { TestStepResultStatus, type Envelope } from '@cucumber/messages';
import type { FailureOutcome } from '@core/failure-analysis';

export type AttemptStatus = 'passed' | 'failed' | 'skipped' | 'unknown';

export interface AttemptFailure {
  readonly step: string;
  readonly outcome: FailureOutcome;
  readonly errorName?: string;
  readonly message?: string;
}

export interface ScenarioAttempt {
  readonly pickleId: string;
  readonly name: string;
  readonly uri: string;
  readonly tags: readonly string[];
  readonly attempt: number;
  readonly status: AttemptStatus;
  readonly willBeRetried: boolean;
  readonly failure?: AttemptFailure;
}

interface StepResult {
  readonly testStepId: string;
  readonly status: TestStepResultStatus;
  readonly errorName?: string;
  readonly message?: string;
}

interface StartedAttempt {
  readonly testCaseId: string;
  readonly attempt: number;
  readonly steps: StepResult[];
  willBeRetried?: boolean;
}

const FAILURE_OUTCOMES: Readonly<Partial<Record<TestStepResultStatus, FailureOutcome>>> = {
  FAILED: 'failed',
  AMBIGUOUS: 'ambiguous',
  UNDEFINED: 'undefined',
  PENDING: 'pending',
};

/** Parses NDJSON text into envelopes. Throws with the offending line number on invalid JSON. */
export function parseEnvelopes(ndjson: string): Envelope[] {
  return ndjson
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== '')
    .map(({ line, number }) => {
      try {
        return JSON.parse(line) as Envelope;
      } catch (error: unknown) {
        throw new Error(`Cucumber messages line ${String(number)} is not valid JSON.`, {
          cause: error,
        });
      }
    });
}

/** Correlates pickles, test cases and step results into attempts, in the order they started. */
export function collectAttempts(envelopes: readonly Envelope[]): ScenarioAttempt[] {
  const pickles = new Map<string, NonNullable<Envelope['pickle']>>();
  const testCases = new Map<string, NonNullable<Envelope['testCase']>>();
  const hookNames = new Map<string, string>();
  const started = new Map<string, StartedAttempt>();

  for (const envelope of envelopes) {
    if (envelope.pickle) {
      pickles.set(envelope.pickle.id, envelope.pickle);
    } else if (envelope.testCase) {
      testCases.set(envelope.testCase.id, envelope.testCase);
    } else if (envelope.hook) {
      hookNames.set(envelope.hook.id, envelope.hook.name ?? 'unnamed hook');
    } else if (envelope.testCaseStarted) {
      const { id, testCaseId, attempt } = envelope.testCaseStarted;
      started.set(id, { testCaseId, attempt, steps: [] });
    } else if (envelope.testStepFinished) {
      const { testCaseStartedId, testStepId, testStepResult } = envelope.testStepFinished;
      const exception = testStepResult.exception;
      started.get(testCaseStartedId)?.steps.push({
        testStepId,
        status: testStepResult.status,
        ...(exception === undefined ? {} : { errorName: exception.type }),
        ...messageOf(exception?.message, testStepResult.message),
      });
    } else if (envelope.testCaseFinished) {
      const attempt = started.get(envelope.testCaseFinished.testCaseStartedId);
      if (attempt !== undefined) {
        attempt.willBeRetried = envelope.testCaseFinished.willBeRetried;
      }
    }
  }

  return [...started.values()].flatMap((attempt) => {
    const testCase = testCases.get(attempt.testCaseId);
    const pickle = testCase === undefined ? undefined : pickles.get(testCase.pickleId);
    if (testCase === undefined || pickle === undefined) {
      return [];
    }
    const describeStep = (testStepId: string): string => {
      const testStep = testCase.testSteps.find((step) => step.id === testStepId);
      if (testStep?.hookId !== undefined) {
        return `Hook: ${hookNames.get(testStep.hookId) ?? 'unnamed hook'}`;
      }
      const pickleStep = pickle.steps.find((step) => step.id === testStep?.pickleStepId);
      return pickleStep?.text ?? 'unknown step';
    };
    const failure = findFailure(attempt.steps, describeStep);
    return [
      {
        pickleId: pickle.id,
        name: pickle.name,
        uri: pickle.uri,
        tags: pickle.tags.map((tag) => tag.name),
        attempt: attempt.attempt,
        status: statusOf(attempt, failure),
        willBeRetried: attempt.willBeRetried ?? false,
        ...(failure === undefined ? {} : { failure }),
      },
    ];
  });
}

function findFailure(
  steps: readonly StepResult[],
  describeStep: (testStepId: string) => string,
): AttemptFailure | undefined {
  for (const step of steps) {
    const outcome = FAILURE_OUTCOMES[step.status];
    if (outcome !== undefined) {
      return {
        step: describeStep(step.testStepId),
        outcome,
        ...(step.errorName === undefined ? {} : { errorName: step.errorName }),
        ...(step.message === undefined ? {} : { message: step.message }),
      };
    }
  }
  return undefined;
}

function statusOf(attempt: StartedAttempt, failure: AttemptFailure | undefined): AttemptStatus {
  if (attempt.willBeRetried === undefined) {
    return 'unknown';
  }
  if (failure !== undefined) {
    return 'failed';
  }
  // Like Cucumber: without a failure, any skipped step makes the scenario skipped.
  return attempt.steps.some((step) => step.status === TestStepResultStatus.SKIPPED)
    ? 'skipped'
    : 'passed';
}

function messageOf(...candidates: readonly (string | undefined)[]): { message?: string } {
  const message = candidates.find((candidate) => candidate !== undefined && candidate !== '');
  return message === undefined ? {} : { message };
}
