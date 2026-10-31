import {
  INTENTS,
  type AutomationLayer,
  type Intent,
  type ScenarioMode,
  type TracedScenario,
} from './collect-scenarios';
import type { ExecutionResult, RunResults } from './execution-results';
import { requirementIdOf, type RequirementsCatalogue } from './requirements-catalogue';

/** Scenarios carrying this tag must be traced to acceptance criteria. */
export const TRACED_TAG = '@healthcare';

export interface MatrixRow {
  readonly requirementId: string;
  readonly criterionId: string;
  /** Undefined when no scenario covers the criterion. */
  readonly scenario: TracedScenario | undefined;
  /** Undefined when no run results were supplied or the scenario was not in the run. */
  readonly result: ExecutionResult | undefined;
}

export type CoverageStatus = 'automated' | 'manual only' | 'blocked only' | 'not covered';

export interface CoverageSummary {
  readonly requirements: Readonly<Record<CoverageStatus, number>> & { readonly total: number };
  readonly criteria: Readonly<Record<CoverageStatus, number>> & { readonly total: number };
  readonly scenarios: {
    readonly total: number;
    readonly byLayer: Readonly<Record<AutomationLayer, number>>;
    readonly byIntent: Readonly<Record<Intent, number>>;
    readonly byMode: Readonly<Record<ScenarioMode, number>>;
  };
  /** Only when run results were supplied: automated scenarios by final status. */
  readonly execution:
    | Readonly<{ passed: number; failed: number; skipped: number; flaky: number; notRun: number }>
    | undefined;
}

export interface TraceabilityMatrix {
  readonly rows: readonly MatrixRow[];
  readonly coverage: CoverageSummary;
  readonly criterionCoverage: ReadonlyMap<string, CoverageStatus>;
  /** Broken links between tags and the catalogue; any issue fails `traceability:check`. */
  readonly issues: readonly string[];
  readonly runStartedAt: string | undefined;
}

export function buildMatrix(
  catalogue: RequirementsCatalogue,
  allScenarios: readonly TracedScenario[],
  run?: RunResults,
): TraceabilityMatrix {
  const scenarios = allScenarios.filter(
    (scenario) => scenario.tags.includes(TRACED_TAG) || scenario.criterionIds.length > 0,
  );
  const issues = findIssues(catalogue, scenarios);
  const rows: MatrixRow[] = [];
  const criterionCoverage = new Map<string, CoverageStatus>();
  for (const requirement of catalogue.requirements) {
    for (const criterion of requirement.acceptanceCriteria) {
      const covering = scenarios.filter((scenario) => scenario.criterionIds.includes(criterion.id));
      criterionCoverage.set(criterion.id, coverageOf(covering.map((scenario) => scenario.mode)));
      const base = { requirementId: requirement.id, criterionId: criterion.id };
      if (covering.length === 0) {
        rows.push({ ...base, scenario: undefined, result: undefined });
      }
      for (const scenario of covering) {
        rows.push({ ...base, scenario, result: run?.byLocation.get(scenario.location) });
      }
    }
  }
  return {
    rows,
    criterionCoverage,
    coverage: summarize(catalogue, scenarios, criterionCoverage, run),
    issues,
    runStartedAt: run?.startedAt,
  };
}

function findIssues(
  catalogue: RequirementsCatalogue,
  scenarios: readonly TracedScenario[],
): string[] {
  const requirementIds = new Set(catalogue.requirements.map((requirement) => requirement.id));
  const criterionIds = new Set(
    catalogue.requirements.flatMap((requirement) =>
      requirement.acceptanceCriteria.map((each) => each.id),
    ),
  );
  const issues: string[] = [];
  for (const scenario of scenarios) {
    const where = `${scenario.location} "${scenario.name}"`;
    if (scenario.criterionIds.length === 0) {
      issues.push(`${where} is tagged ${TRACED_TAG} but has no @AC tag`);
    }
    for (const id of scenario.requirementIds.filter((each) => !requirementIds.has(each))) {
      issues.push(`${where} references unknown requirement ${id}`);
    }
    for (const id of scenario.criterionIds) {
      if (!criterionIds.has(id)) {
        issues.push(`${where} references unknown acceptance criterion ${id}`);
      } else if (!scenario.requirementIds.includes(requirementIdOf(id))) {
        issues.push(`${where} covers ${id} but is not tagged @${requirementIdOf(id)}`);
      }
    }
  }
  return [...new Set(issues)];
}

function coverageOf(modes: readonly ScenarioMode[]): CoverageStatus {
  if (modes.includes('automated')) {
    return 'automated';
  }
  if (modes.includes('manual')) {
    return 'manual only';
  }
  return modes.includes('blocked') ? 'blocked only' : 'not covered';
}

function tally(
  statuses: readonly CoverageStatus[],
): Record<CoverageStatus, number> & { total: number } {
  const count = (status: CoverageStatus): number =>
    statuses.filter((each) => each === status).length;
  return {
    total: statuses.length,
    automated: count('automated'),
    'manual only': count('manual only'),
    'blocked only': count('blocked only'),
    'not covered': count('not covered'),
  };
}

/** A requirement takes the status of its least-covered criterion. */
function requirementCoverage(statuses: readonly CoverageStatus[]): CoverageStatus {
  const order: readonly CoverageStatus[] = [
    'not covered',
    'blocked only',
    'manual only',
    'automated',
  ];
  return order.find((status) => statuses.includes(status)) ?? 'not covered';
}

function summarize(
  catalogue: RequirementsCatalogue,
  scenarios: readonly TracedScenario[],
  criterionCoverage: ReadonlyMap<string, CoverageStatus>,
  run: RunResults | undefined,
): CoverageSummary {
  const requirementStatuses = catalogue.requirements.map((requirement) =>
    requirementCoverage(
      requirement.acceptanceCriteria.map((each) => criterionCoverage.get(each.id) ?? 'not covered'),
    ),
  );
  const count = (predicate: (scenario: TracedScenario) => boolean): number =>
    scenarios.filter(predicate).length;
  const layers: readonly AutomationLayer[] = ['UI', 'API', 'UI + API', 'Unspecified'];
  const modes: readonly ScenarioMode[] = ['automated', 'manual', 'blocked'];
  return {
    requirements: tally(requirementStatuses),
    criteria: tally([...criterionCoverage.values()]),
    scenarios: {
      total: scenarios.length,
      byLayer: Object.fromEntries(
        layers.map((layer) => [layer, count((each) => each.layer === layer)]),
      ) as Record<AutomationLayer, number>,
      byIntent: Object.fromEntries(
        INTENTS.map((intent) => [intent, count((each) => each.intents.includes(intent))]),
      ) as Record<Intent, number>,
      byMode: Object.fromEntries(
        modes.map((mode) => [mode, count((each) => each.mode === mode)]),
      ) as Record<ScenarioMode, number>,
    },
    execution: run === undefined ? undefined : executionSummary(scenarios, run),
  };
}

function executionSummary(
  scenarios: readonly TracedScenario[],
  run: RunResults,
): NonNullable<CoverageSummary['execution']> {
  const results = scenarios
    .filter((scenario) => scenario.mode === 'automated')
    .map((scenario) => run.byLocation.get(scenario.location));
  const count = (status: ExecutionResult['status']): number =>
    results.filter((result) => result?.status === status).length;
  return {
    passed: count('passed'),
    failed: count('failed'),
    skipped: count('skipped'),
    flaky: results.filter((result) => result?.flaky === true).length,
    notRun: results.filter((result) => result === undefined || result.status === 'unknown').length,
  };
}
