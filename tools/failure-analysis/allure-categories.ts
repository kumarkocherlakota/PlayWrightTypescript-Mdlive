/**
 * Allure 3 category rules backed by the framework classifier, so the Allure report, the failure
 * analysis and the per-scenario classification attachment always agree. Loaded by allurerc.mjs.
 */
import {
  classifyFailure,
  FAILURE_CATEGORIES,
  FAILURE_CATEGORY_IDS,
  type FailureCategoryId,
  type FailureEvidence,
} from '@core/failure-analysis';

/** The subset of Allure's category matching data the rules read. */
export interface AllureMatchingData {
  readonly status: string;
  readonly message?: string;
  readonly trace?: string;
  readonly flaky: boolean;
}

export interface AllureCategoryRule {
  readonly id: string;
  readonly name: string;
  readonly matchers: ((data: AllureMatchingData) => boolean) | { readonly flaky: boolean };
  readonly groupByMessage?: boolean;
  readonly expand?: boolean;
}

const ERROR_HEADER = /^([A-Za-z]*Error)(?: \[[^\]]*\])?: ([\s\S]*)$/;
const FAILED_STATUSES = new Set(['failed', 'broken']);
const AUTOMATION_GAP_MESSAGE =
  /^The (step|test) doesn't have an implementation\.|Multiple step definitions match/;

/** Splits Cucumber's formatted error ("LocatorError: message\n    at …") into evidence. */
export function evidenceFromReportedError(text: string): FailureEvidence {
  const match = ERROR_HEADER.exec(text.trimStart());
  const [, errorName, message] = match ?? [];
  return errorName === undefined || message === undefined
    ? { message: text }
    : { errorName, message };
}

/**
 * Classifies an Allure test result. Allure marks undefined, pending and ambiguous steps as
 * `broken`: undefined ones with a fixed message, pending ones without any message.
 */
export function classifyReportedFailure(data: AllureMatchingData): FailureCategoryId {
  const text = data.message ?? data.trace ?? '';
  if (AUTOMATION_GAP_MESSAGE.test(text)) {
    return 'automation-gap';
  }
  if (text.trim() === '') {
    return data.status === 'broken' ? 'automation-gap' : 'unclassified';
  }
  return classifyFailure(evidenceFromReportedError(text)).category;
}

/** One Allure category per framework category (first match wins), then flaky passes. */
export function allureCategoryRules(): AllureCategoryRule[] {
  return [
    ...FAILURE_CATEGORY_IDS.map((id) => ({
      id: `framework-${id}`,
      name: FAILURE_CATEGORIES[id].title,
      matchers: (data: AllureMatchingData) =>
        FAILED_STATUSES.has(data.status) && classifyReportedFailure(data) === id,
      groupByMessage: true,
    })),
    {
      id: 'framework-flaky',
      name: 'Flaky (failed, then passed on retry)',
      matchers: { flaky: true },
    },
  ];
}
