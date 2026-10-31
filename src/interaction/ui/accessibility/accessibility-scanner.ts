import AxeBuilder from '@axe-core/playwright';
import type { AccessibilityConfig } from '@core/config';
import { ValidationError } from '@core/errors';
import type { UiContext } from '../ui-context';
import { axeTagsFor, reachesThreshold, type ImpactLevel } from './wcag-target';

/** Stated in every result: a clean automated scan is not an accessibility sign-off. */
export const MANUAL_TESTING_NOTE =
  'Automated checks find only part of the WCAG failures. They do not replace manual accessibility testing with keyboards, screen readers and other assistive technology.';

const MAX_TARGETS_PER_VIOLATION = 5;

/** One failed axe rule. Element HTML is left out because it can contain personal data. */
export interface AccessibilityViolation {
  readonly rule: string;
  readonly impact: ImpactLevel | 'unknown';
  readonly help: string;
  readonly helpUrl: string;
  readonly wcagTags: readonly string[];
  readonly elementCount: number;
  /** CSS selectors of the first affected elements, for locating them in the page. */
  readonly targets: readonly string[];
  readonly blocking: boolean;
}

/** Result of scanning one page state; safe to attach to reports. */
export interface AccessibilityScanResult {
  readonly label: string;
  /** Origin and path only; query strings can carry identifiers. */
  readonly page: string;
  readonly standard: AccessibilityConfig['standard'];
  readonly failOnImpact: ImpactLevel;
  readonly violations: readonly AccessibilityViolation[];
  readonly passedRules: number;
  /** Rules axe could not decide automatically; they need manual review. */
  readonly needsReview: readonly string[];
  readonly note: string;
}

/**
 * Runs axe-core against the current page for the configured WCAG target
 * (`accessibility.standard`) and marks violations at or above `accessibility.failOnImpact` as
 * blocking. Scanning never fails by itself; call {@link assertNoBlockingViolations} after
 * attaching the result so the evidence is reported either way.
 */
export class AccessibilityScanner {
  public constructor(
    private readonly ui: UiContext,
    private readonly target: AccessibilityConfig,
  ) {}

  public async scan(label: string): Promise<AccessibilityScanResult> {
    const results = await new AxeBuilder({ page: this.ui.page })
      .withTags([...axeTagsFor(this.target.standard)])
      .analyze();
    const violations = results.violations.map((violation): AccessibilityViolation => {
      const impact = violation.impact ?? 'unknown';
      return {
        rule: violation.id,
        impact,
        help: violation.help,
        helpUrl: violation.helpUrl,
        wcagTags: violation.tags.filter((tag) => tag.startsWith('wcag')),
        elementCount: violation.nodes.length,
        targets: violation.nodes
          .slice(0, MAX_TARGETS_PER_VIOLATION)
          .map((node) => node.target.map(String).join(' ')),
        blocking: reachesThreshold(impact, this.target.failOnImpact),
      };
    });
    const pageUrl = new URL(this.ui.page.url());
    const result: AccessibilityScanResult = {
      label,
      page: `${pageUrl.origin}${pageUrl.pathname}`,
      standard: this.target.standard,
      failOnImpact: this.target.failOnImpact,
      violations,
      passedRules: results.passes.length,
      needsReview: results.incomplete.map((rule) => rule.id),
      note: MANUAL_TESTING_NOTE,
    };
    this.ui.logger.info('Accessibility scan finished', {
      label,
      page: result.page,
      violations: violations.length,
      blocking: violations.filter((violation) => violation.blocking).length,
    });
    return result;
  }
}

/**
 * Throws a `ValidationError` naming each blocking rule, its impact and the number of affected
 * elements. Non-blocking violations stay in the attached result only.
 */
export function assertNoBlockingViolations(result: AccessibilityScanResult): void {
  const blocking = result.violations.filter((violation) => violation.blocking);
  if (blocking.length === 0) {
    return;
  }
  const summary = blocking
    .map(
      (violation) => `${violation.rule} (${violation.impact}, ${violation.elementCount} elements)`,
    )
    .join(', ');
  throw new ValidationError(
    `${result.label} has accessibility violations at or above "${result.failOnImpact}" impact for ${result.standard}: ${summary}.`,
    { context: { page: result.page, rules: blocking.map((violation) => violation.rule) } },
  );
}
