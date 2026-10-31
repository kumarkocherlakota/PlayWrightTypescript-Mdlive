import type { AccessibilityConfig } from '@core/config';

export type AccessibilityStandard = AccessibilityConfig['standard'];
export type ImpactLevel = AccessibilityConfig['failOnImpact'];

/** axe-core impact levels, least to most severe. */
export const IMPACT_LEVELS: readonly ImpactLevel[] = ['minor', 'moderate', 'serious', 'critical'];

const TAGS_BY_STANDARD: Readonly<Record<AccessibilityStandard, readonly string[]>> = {
  wcag2a: ['wcag2a'],
  wcag2aa: ['wcag2a', 'wcag2aa'],
  wcag21aa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  wcag22aa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
};

/**
 * axe-core rule tags that make up a conformance target. Each level includes the levels below
 * it, as WCAG conformance does (WCAG 2.2 AA includes 2.1 and 2.0 A and AA).
 */
export function axeTagsFor(standard: AccessibilityStandard): readonly string[] {
  return TAGS_BY_STANDARD[standard];
}

/**
 * Whether a violation of `impact` reaches the configured failure threshold. A violation that
 * axe reports without an impact is treated as blocking, so an unknown severity never passes.
 */
export function reachesThreshold(
  impact: string | null | undefined,
  threshold: ImpactLevel,
): boolean {
  const index = IMPACT_LEVELS.findIndex((level) => level === impact);
  return index === -1 || index >= IMPACT_LEVELS.indexOf(threshold);
}
