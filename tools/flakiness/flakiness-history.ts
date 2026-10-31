import type { Envelope } from '@cucumber/messages';
import { z } from 'zod';
import { resultsFromRun } from '../traceability/execution-results';

/** One scenario's result in one run; a line of `history.jsonl`. No step text or error details. */
export interface HistoryRecord {
  readonly runStartedAt: string;
  /** Browser of the run (`BROWSER`); results of different browsers are judged separately. */
  readonly browser: string;
  /** `features/<file>.feature:<line>` of the scenario or Examples row. */
  readonly location: string;
  readonly status: 'passed' | 'failed' | 'skipped' | 'unknown';
  readonly attempts: number;
  /** Failed, then passed on retry within the run. */
  readonly flakyInRun: boolean;
}

export const historyRecordSchema = z.strictObject({
  runStartedAt: z.string().min(1),
  browser: z.string().min(1),
  location: z.string().min(1),
  status: z.enum(['passed', 'failed', 'skipped', 'unknown']),
  attempts: z.int().positive(),
  flakyInRun: z.boolean(),
});

/** The run's results as history records; skipped scenarios carry no stability signal. */
export function recordsFromRun(envelopes: readonly Envelope[], browser: string): HistoryRecord[] {
  const run = resultsFromRun(envelopes);
  if (run.startedAt === undefined) {
    return [];
  }
  const runStartedAt = run.startedAt;
  return [...run.byLocation]
    .filter(([, result]) => result.status !== 'skipped')
    .map(([location, result]) => ({
      runStartedAt,
      browser,
      location,
      status: result.status,
      attempts: result.attempts,
      flakyInRun: result.flaky,
    }));
}

/** Keeps the records of the most recent `maxRuns` runs (by start time). */
export function trimToRecentRuns(
  records: readonly HistoryRecord[],
  maxRuns: number,
): HistoryRecord[] {
  const recent = new Set(
    [...new Set(records.map((record) => record.runStartedAt))].sort().slice(-maxRuns),
  );
  return records.filter((record) => recent.has(record.runStartedAt));
}

export interface UnstableScenario {
  readonly location: string;
  readonly browser: string;
  readonly runs: number;
  readonly passedRuns: number;
  readonly failedRuns: number;
  /** Runs where the scenario passed only after a retry. */
  readonly flakyRuns: number;
  /** Share of consecutive runs whose final status differs, 0..1. */
  readonly flipRate: number;
  readonly lastStatus: HistoryRecord['status'];
}

export interface FlakinessReport {
  readonly runsAnalysed: number;
  readonly scenariosAnalysed: number;
  /** Mixed outcomes across runs, or passes that needed a retry; most unstable first. */
  readonly unstable: readonly UnstableScenario[];
  /** Failed in every analysed run: a consistent failure, not flakiness. */
  readonly consistentlyFailing: readonly string[];
}

/**
 * Judges stability per scenario and browser across the recorded runs. A scenario is unstable
 * when it both passed and failed across runs, or passed only after a retry in some run. A
 * scenario that always fails is reported separately: it is broken, not flaky.
 */
export function analyzeFlakiness(records: readonly HistoryRecord[]): FlakinessReport {
  const series = new Map<string, HistoryRecord[]>();
  for (const record of [...records].sort((a, b) => a.runStartedAt.localeCompare(b.runStartedAt))) {
    const key = `${record.browser} ${record.location}`;
    series.set(key, [...(series.get(key) ?? []), record]);
  }
  const unstable: UnstableScenario[] = [];
  const consistentlyFailing: string[] = [];
  for (const runs of series.values()) {
    const first = runs[0];
    if (first === undefined) {
      continue;
    }
    const passedRuns = runs.filter((run) => run.status === 'passed').length;
    const failedRuns = runs.filter((run) => run.status === 'failed').length;
    const flakyRuns = runs.filter((run) => run.flakyInRun).length;
    const flips = runs.slice(1).filter((run, index) => run.status !== runs[index]?.status).length;
    if ((passedRuns > 0 && failedRuns > 0) || flakyRuns > 0) {
      unstable.push({
        location: first.location,
        browser: first.browser,
        runs: runs.length,
        passedRuns,
        failedRuns,
        flakyRuns,
        flipRate: runs.length > 1 ? flips / (runs.length - 1) : 0,
        lastStatus: runs.at(-1)?.status ?? 'unknown',
      });
    } else if (failedRuns === runs.length) {
      consistentlyFailing.push(`${first.location} (${first.browser})`);
    }
  }
  unstable.sort(
    (a, b) =>
      b.flipRate - a.flipRate || b.flakyRuns - a.flakyRuns || a.location.localeCompare(b.location),
  );
  return {
    runsAnalysed: new Set(records.map((record) => record.runStartedAt)).size,
    scenariosAnalysed: series.size,
    unstable,
    consistentlyFailing: consistentlyFailing.sort(),
  };
}

/** Markdown summary; the guidance reflects the rule that retries and waits are not fixes. */
export function renderFlakinessMarkdown(report: FlakinessReport): string {
  const rows = report.unstable.map(
    (scenario) =>
      `| \`${scenario.location}\` | ${scenario.browser} | ${String(scenario.runs)} | ${String(scenario.passedRuns)} | ${String(scenario.failedRuns)} | ${String(scenario.flakyRuns)} | ${(scenario.flipRate * 100).toFixed(0)}% | ${scenario.lastStatus} |`,
  );
  return [
    '# Flakiness report',
    '',
    `${String(report.runsAnalysed)} recorded runs, ${String(report.scenariosAnalysed)} scenario and browser combinations.`,
    '',
    '## Unstable scenarios',
    '',
    rows.length === 0
      ? 'None in the recorded runs.'
      : [
          '| Scenario | Browser | Runs | Passed | Failed | Passed on retry | Flip rate | Last |',
          '| --- | --- | --- | --- | --- | --- | --- | --- |',
          ...rows,
        ].join('\n'),
    '',
    '## Failing in every recorded run',
    '',
    report.consistentlyFailing.length === 0
      ? 'None.'
      : report.consistentlyFailing.map((entry) => `- \`${entry}\``).join('\n'),
    '',
    'Find the cause in the failing attempts (`reports/analysis`). Do not add fixed waits, longer',
    'timeouts or retries: they hide the defect instead of fixing it (RULE-006).',
    '',
  ].join('\n');
}
