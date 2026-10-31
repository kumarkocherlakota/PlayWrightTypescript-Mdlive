/** Stable identifiers for every failure category, ordered from most to least specific. */
export const FAILURE_CATEGORY_IDS = [
  'automation-gap',
  'configuration',
  'test-data',
  'authentication',
  'environment',
  'contract',
  'api-error',
  'locator',
  'timeout',
  'assertion',
  'unclassified',
] as const;

export type FailureCategoryId = (typeof FAILURE_CATEGORY_IDS)[number];

/** Who most likely needs to act on a failure first. A triage hint, not a verdict. */
export type FailureOwner = 'product' | 'automation' | 'environment' | 'investigate';

/** Human-facing description of a failure category, shared by every report. */
export interface FailureCategory {
  readonly id: FailureCategoryId;
  readonly title: string;
  readonly owner: FailureOwner;
  readonly guidance: string;
}

/**
 * Catalogue of failure categories. Titles are used as the Allure `failureCategory` label value,
 * so changing one regroups historical reports.
 */
export const FAILURE_CATEGORIES: Readonly<Record<FailureCategoryId, FailureCategory>> = {
  'automation-gap': {
    id: 'automation-gap',
    title: 'Automation gap (undefined, pending or ambiguous step)',
    owner: 'automation',
    guidance: 'Implement or disambiguate the step definition; no product behaviour was checked.',
  },
  configuration: {
    id: 'configuration',
    title: 'Configuration error',
    owner: 'automation',
    guidance: 'Check the selected environment file, environment variables and CI secrets.',
  },
  'test-data': {
    id: 'test-data',
    title: 'Test data setup or cleanup failure',
    owner: 'automation',
    guidance:
      'Check data builders, preconditions and cleanup; the environment may hold stale data.',
  },
  authentication: {
    id: 'authentication',
    title: 'Authentication or authorization failure',
    owner: 'environment',
    guidance: 'Check the test account, its permissions and the identity provider for this run.',
  },
  environment: {
    id: 'environment',
    title: 'Environment or dependency unavailable',
    owner: 'environment',
    guidance: 'Check that the application and its dependencies were reachable and healthy.',
  },
  contract: {
    id: 'contract',
    title: 'API contract violation',
    owner: 'product',
    guidance:
      'The response shape changed. Confirm whether the change is intended with the API team.',
  },
  'api-error': {
    id: 'api-error',
    title: 'Unexpected API response',
    owner: 'investigate',
    guidance: 'Compare the request with the API specification and the returned status code.',
  },
  locator: {
    id: 'locator',
    title: 'UI element not found or not actionable',
    owner: 'investigate',
    guidance:
      'Open the trace: either the UI changed (update the page object) or it did not render.',
  },
  timeout: {
    id: 'timeout',
    title: 'Timeout',
    owner: 'investigate',
    guidance:
      'Check for slow responses in the logs before raising timeouts; never add fixed waits.',
  },
  assertion: {
    id: 'assertion',
    title: 'Assertion failed (possible product defect)',
    owner: 'product',
    guidance:
      'Compare expected and actual behaviour against the requirement before raising a defect.',
  },
  unclassified: {
    id: 'unclassified',
    title: 'Unclassified failure',
    owner: 'investigate',
    guidance: 'No rule matched. Inspect the error and consider wrapping it in a FrameworkError.',
  },
};
