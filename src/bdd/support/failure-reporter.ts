import { Status } from '@cucumber/cucumber';
import type { TestStepResultStatus } from '@cucumber/messages';
import {
  classifyFailure,
  evidenceFromError,
  type FailureClassification,
  type FailureOutcome,
} from '@core/failure-analysis';
import type { CustomWorld } from '@bdd/world/custom-world';

const OUTCOMES: Readonly<Partial<Record<TestStepResultStatus, FailureOutcome>>> = {
  [Status.FAILED]: 'failed',
  [Status.UNDEFINED]: 'undefined',
  [Status.PENDING]: 'pending',
  [Status.AMBIGUOUS]: 'ambiguous',
};

/**
 * Classifies a non-passing scenario attempt, logs the result at error level and attaches it as
 * failure-classification.json so every report format carries the same triage hint.
 * Returns undefined for passed or skipped attempts.
 */
export function reportScenarioFailure(
  world: CustomWorld,
  status: TestStepResultStatus,
  error: unknown,
): FailureClassification | undefined {
  const outcome = OUTCOMES[status];
  if (outcome === undefined) {
    return undefined;
  }
  const classification = classifyFailure({
    outcome,
    ...(error === undefined ? {} : evidenceFromError(error)),
  });
  const summary = {
    category: classification.category,
    title: classification.title,
    owner: classification.owner,
    reason: classification.reason,
    guidance: classification.guidance,
    attempt: world.scenario.attempt,
  };
  world.logger.error('Scenario failure classified', summary);
  world.attach(JSON.stringify(summary, null, 2), {
    mediaType: 'application/json',
    fileName: 'failure-classification.json',
  });
  return classification;
}
