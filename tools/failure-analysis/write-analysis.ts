import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Redactor } from '@core/security';
import { analyzeRun, type RunAnalysis } from './analyze-run';
import { markFlakyRetries } from './mark-allure-flaky';
import { renderMarkdown } from './render-markdown';
import { collectAttempts, parseEnvelopes } from './scenario-attempts';

export interface AnalysisPaths {
  readonly messagesFile: string;
  readonly outputDirectory: string;
  /** When present, retried-then-passed results in it are flagged as flaky for Allure. */
  readonly allureResultsDirectory?: string;
}

export interface AnalysisOutput {
  readonly analysis: RunAnalysis;
  readonly jsonFile: string;
  readonly markdownFile: string;
  readonly allureFlakyMarked: number;
}

/**
 * Reads a Cucumber messages file, writes failure-analysis.json and failure-analysis.md, and
 * flags flaky retries in the Allure results.
 */
export async function writeAnalysis(paths: AnalysisPaths): Promise<AnalysisOutput> {
  const ndjson = await readFile(paths.messagesFile, 'utf8');
  const analysis = analyzeRun(collectAttempts(parseEnvelopes(ndjson)), new Redactor());
  await mkdir(paths.outputDirectory, { recursive: true });
  const jsonFile = path.join(paths.outputDirectory, 'failure-analysis.json');
  const markdownFile = path.join(paths.outputDirectory, 'failure-analysis.md');
  await writeFile(jsonFile, `${JSON.stringify(analysis, null, 2)}\n`);
  await writeFile(markdownFile, renderMarkdown(analysis));
  const allureFlakyMarked =
    paths.allureResultsDirectory !== undefined && existsSync(paths.allureResultsDirectory)
      ? await markFlakyRetries(paths.allureResultsDirectory)
      : 0;
  return { analysis, jsonFile, markdownFile, allureFlakyMarked };
}

/** One-line console summary of an analysis. */
export function describeTotals(analysis: RunAnalysis): string {
  const { totals } = analysis;
  return (
    `${String(totals.scenarios)} scenarios: ${String(totals.passed)} passed, ` +
    `${String(totals.failed)} failed, ${String(totals.flaky)} flaky, ` +
    `${String(totals.skipped)} skipped, ${String(totals.incomplete)} incomplete`
  );
}
