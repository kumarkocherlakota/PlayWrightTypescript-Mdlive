import { FrameworkError } from '@core/errors';
import {
  FAILURE_CATEGORIES,
  type FailureCategory,
  type FailureCategoryId,
} from './failure-category';

/** How a scenario step ended when it did not pass. */
export type FailureOutcome = 'failed' | 'undefined' | 'pending' | 'ambiguous';

/**
 * What is known about a failure. During a run the error object is available; afterwards only
 * the class name and message recorded by the runner are.
 */
export interface FailureEvidence {
  readonly outcome?: FailureOutcome;
  readonly errorName?: string;
  readonly errorCode?: string;
  readonly message?: string;
}

/** The category a failure belongs to and the rule that put it there. */
export interface FailureClassification extends FailureCategory {
  readonly category: FailureCategoryId;
  readonly reason: string;
}

interface NormalizedEvidence {
  readonly outcome: FailureOutcome;
  readonly name: string;
  readonly code: string;
  readonly message: string;
}

interface ClassificationRule {
  readonly category: FailureCategoryId;
  readonly reason: string | ((evidence: NormalizedEvidence) => string);
  readonly applies: (evidence: NormalizedEvidence) => boolean;
}

/** Recovers the FrameworkError code when only the class name survived (post-run analysis). */
const CODE_BY_ERROR_NAME: Readonly<Record<string, string>> = {
  ConfigurationError: 'CONFIGURATION',
  NavigationError: 'NAVIGATION',
  AuthenticationError: 'AUTHENTICATION',
  ApiRequestError: 'API_REQUEST',
  LocatorError: 'LOCATOR',
  TestDataError: 'TEST_DATA',
  ValidationError: 'VALIDATION',
};

// eslint-disable-next-line no-control-regex -- Playwright messages contain ANSI colour codes.
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;
const NETWORK_FAILURE = /\b(ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT)\b|net::ERR_/;
const PLAYWRIGHT_EXPECT = /(^|\n)(Error: )?expect\(|\bExpected\b[\s\S]*\bReceived\b/;
const RAW_LOCATOR_FAILURE = /strict mode violation|waiting for (locator|getBy)/;

const RULES: readonly ClassificationRule[] = [
  {
    category: 'automation-gap',
    reason: (e) => `A step is ${e.outcome}, so the scenario could not run to completion.`,
    applies: (e) => e.outcome !== 'failed',
  },
  {
    category: 'configuration',
    reason: 'The framework rejected its configuration.',
    applies: (e) => e.code === 'CONFIGURATION',
  },
  {
    category: 'test-data',
    reason: 'Test data could not be prepared or cleaned up.',
    applies: (e) => e.code === 'TEST_DATA',
  },
  {
    category: 'authentication',
    reason: 'Authentication failed or the service answered 401/403.',
    applies: (e) =>
      e.code === 'AUTHENTICATION' ||
      (e.code === 'API_REQUEST' && /returned HTTP 40[13]\b/.test(e.message)),
  },
  {
    category: 'environment',
    reason: 'The application or a dependency was unreachable or answered with a server error.',
    applies: (e) =>
      (e.code === 'API_REQUEST' &&
        /failed before a response arrived|returned HTTP 5\d\d\b/.test(e.message)) ||
      (e.code === 'NAVIGATION' && /^Could not open|responded with HTTP 5\d\d\b/.test(e.message)) ||
      NETWORK_FAILURE.test(e.message),
  },
  {
    category: 'contract',
    reason: 'A response did not match its declared contract.',
    applies: (e) =>
      (e.code === 'VALIDATION' && /does not match the .+ contract/.test(e.message)) ||
      (e.code === 'API_REQUEST' && e.message.includes('returned invalid JSON')),
  },
  {
    category: 'api-error',
    reason: 'An API request returned an unexpected result.',
    applies: (e) => e.code === 'API_REQUEST',
  },
  {
    category: 'locator',
    reason: 'A page or component action could not find or use its element.',
    applies: (e) => e.code === 'LOCATOR',
  },
  {
    category: 'timeout',
    reason: 'An operation exceeded its time budget.',
    applies: (e) =>
      e.name === 'TimeoutError' || /function timed out|^Timed out after/.test(e.message),
  },
  {
    category: 'assertion',
    reason: 'Observed behaviour differed from the expected outcome.',
    applies: (e) =>
      e.name === 'AssertionError' ||
      e.code === 'VALIDATION' ||
      e.code === 'NAVIGATION' ||
      PLAYWRIGHT_EXPECT.test(e.message),
  },
  {
    category: 'locator',
    reason: 'Playwright could not resolve a locator.',
    applies: (e) => RAW_LOCATOR_FAILURE.test(e.message),
  },
];

/**
 * Assigns a failure to exactly one category using ordered rules (first match wins). Uses the
 * FrameworkError `code` when available, the error class name otherwise, then message patterns.
 * The result is a triage hint for humans; it never changes a scenario's pass/fail status.
 */
export function classifyFailure(evidence: FailureEvidence): FailureClassification {
  const name = evidence.errorName ?? '';
  const normalized: NormalizedEvidence = {
    outcome: evidence.outcome ?? 'failed',
    name,
    code: evidence.errorCode ?? CODE_BY_ERROR_NAME[name] ?? '',
    message: (evidence.message ?? '').replace(ANSI_ESCAPE, ''),
  };
  const rule = RULES.find((candidate) => candidate.applies(normalized));
  const category = rule?.category ?? 'unclassified';
  const reason =
    rule === undefined
      ? 'No classification rule matched.'
      : typeof rule.reason === 'string'
        ? rule.reason
        : rule.reason(normalized);
  return { ...FAILURE_CATEGORIES[category], category, reason };
}

/** Builds classification evidence from a thrown value while the scenario is still running. */
export function evidenceFromError(error: unknown): FailureEvidence {
  if (!(error instanceof Error)) {
    return { errorName: 'NonErrorThrown', message: String(error) };
  }
  return {
    errorName: error.name,
    message: error.message,
    ...(error instanceof FrameworkError ? { errorCode: error.code } : {}),
  };
}
