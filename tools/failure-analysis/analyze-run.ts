import {
  classifyFailure,
  type FailureCategoryId,
  type FailureClassification,
  type FailureOwner,
} from '@core/failure-analysis';
import type { Redactor } from '@core/security';
import type { AttemptFailure, ScenarioAttempt } from './scenario-attempts';

export interface ClassifiedFailure {
  readonly attempt: number;
  readonly step: string;
  readonly category: FailureCategoryId;
  readonly title: string;
  readonly owner: FailureOwner;
  readonly reason: string;
  readonly guidance: string;
  readonly errorName?: string;
  readonly message?: string;
}

export interface ScenarioReport {
  readonly scenario: string;
  readonly uri: string;
  readonly tags: readonly string[];
  readonly attempts: number;
  readonly failures: readonly ClassifiedFailure[];
}

export interface RunTotals {
  readonly scenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly flaky: number;
  readonly skipped: number;
  readonly incomplete: number;
}

export interface RunAnalysis {
  readonly totals: RunTotals;
  /** Final-attempt failures per category; flaky scenarios are counted separately. */
  readonly byCategory: Readonly<Partial<Record<FailureCategoryId, number>>>;
  readonly failed: readonly ScenarioReport[];
  /** Scenarios that failed at least once and then passed on retry. */
  readonly flaky: readonly ScenarioReport[];
  readonly incomplete: readonly ScenarioReport[];
}

const MAX_MESSAGE_LINES = 6;
const MAX_MESSAGE_LENGTH = 800;
// eslint-disable-next-line no-control-regex -- Playwright messages contain ANSI colour codes.
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;

/**
 * Groups attempts by scenario, classifies every failed attempt and separates final failures from
 * flaky scenarios. Error messages are shortened and redacted before they enter the result.
 */
export function analyzeRun(attempts: readonly ScenarioAttempt[], redactor: Redactor): RunAnalysis {
  const byScenario = new Map<string, ScenarioAttempt[]>();
  for (const attempt of attempts) {
    byScenario.set(attempt.pickleId, [...(byScenario.get(attempt.pickleId) ?? []), attempt]);
  }

  const failed: ScenarioReport[] = [];
  const flaky: ScenarioReport[] = [];
  const incomplete: ScenarioReport[] = [];
  let passed = 0;
  let skipped = 0;

  for (const scenarioAttempts of byScenario.values()) {
    const ordered = [...scenarioAttempts].sort((left, right) => left.attempt - right.attempt);
    const final = ordered.at(-1);
    if (final === undefined) {
      continue;
    }
    const report = toReport(ordered, redactor);
    if (final.status === 'failed') {
      failed.push(report);
    } else if (final.status === 'unknown') {
      incomplete.push(report);
    } else if (report.failures.length > 0) {
      flaky.push(report);
    } else if (final.status === 'skipped') {
      skipped += 1;
    } else {
      passed += 1;
    }
  }

  const byCategory: Partial<Record<FailureCategoryId, number>> = {};
  for (const report of failed) {
    const category = report.failures.at(-1)?.category;
    if (category !== undefined) {
      byCategory[category] = (byCategory[category] ?? 0) + 1;
    }
  }

  return {
    totals: {
      scenarios: byScenario.size,
      passed,
      failed: failed.length,
      flaky: flaky.length,
      skipped,
      incomplete: incomplete.length,
    },
    byCategory,
    failed,
    flaky,
    incomplete,
  };
}

function toReport(ordered: readonly ScenarioAttempt[], redactor: Redactor): ScenarioReport {
  const first = ordered[0];
  if (first === undefined) {
    throw new Error('A scenario report needs at least one attempt.');
  }
  return {
    scenario: first.name,
    uri: first.uri,
    tags: first.tags,
    attempts: ordered.length,
    failures: ordered.flatMap((attempt) =>
      attempt.failure === undefined ? [] : [classify(attempt.attempt, attempt.failure, redactor)],
    ),
  };
}

function classify(attempt: number, failure: AttemptFailure, redactor: Redactor): ClassifiedFailure {
  const classification: FailureClassification = classifyFailure({
    outcome: failure.outcome,
    ...(failure.errorName === undefined ? {} : { errorName: failure.errorName }),
    ...(failure.message === undefined ? {} : { message: failure.message }),
  });
  return {
    attempt,
    step: redactor.redactText(failure.step),
    category: classification.category,
    title: classification.title,
    owner: classification.owner,
    reason: classification.reason,
    guidance: classification.guidance,
    ...(failure.errorName === undefined ? {} : { errorName: failure.errorName }),
    ...(failure.message === undefined
      ? {}
      : { message: summarizeMessage(failure.message, redactor) }),
  };
}

/** Keeps the head of a message: enough to triage, without dumping call logs into reports. */
export function summarizeMessage(message: string, redactor: Redactor): string {
  const lines = message
    .replace(ANSI_ESCAPE, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .slice(0, MAX_MESSAGE_LINES)
    .join('\n');
  const redacted = redactor.redactText(lines);
  return redacted.length > MAX_MESSAGE_LENGTH
    ? `${redacted.slice(0, MAX_MESSAGE_LENGTH)}…`
    : redacted;
}
