import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEnvelopes } from '../failure-analysis/scenario-attempts';
import {
  analyzeFlakiness,
  historyRecordSchema,
  recordsFromRun,
  renderFlakinessMarkdown,
  trimToRecentRuns,
  type FlakinessReport,
  type HistoryRecord,
} from './flakiness-history';

/** Runs kept in the history; older runs say little about the current code. */
export const MAX_RECORDED_RUNS = 30;

export interface FlakinessPaths {
  readonly messagesFile: string;
  readonly directory: string;
}

/**
 * Appends this run's results to `<directory>/history.jsonl` (keeping the last
 * {@link MAX_RECORDED_RUNS} runs) and writes `flakiness-report.json` and `.md`. CI keeps the
 * history between runs by caching the directory.
 */
export async function recordRunAndReport(
  paths: FlakinessPaths,
  browser: string,
): Promise<{ report: FlakinessReport; markdownFile: string }> {
  const historyFile = path.join(paths.directory, 'history.jsonl');
  const run = recordsFromRun(parseEnvelopes(await readFile(paths.messagesFile, 'utf8')), browser);
  const history = trimToRecentRuns(
    [...(await readHistory(historyFile)), ...run],
    MAX_RECORDED_RUNS,
  );
  const report = analyzeFlakiness(history);
  await mkdir(paths.directory, { recursive: true });
  await writeFile(historyFile, history.map((record) => JSON.stringify(record)).join('\n') + '\n');
  await writeFile(
    path.join(paths.directory, 'flakiness-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const markdownFile = path.join(paths.directory, 'flakiness-report.md');
  await writeFile(markdownFile, renderFlakinessMarkdown(report));
  return { report, markdownFile };
}

/** Reads the history; a missing file is an empty history, a corrupt line is an error. */
export async function readHistory(file: string): Promise<HistoryRecord[]> {
  const text = await readFile(file, 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  });
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      const parsed = historyRecordSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`${file}:${String(index + 1)} is not a valid history record.`);
      }
      return parsed.data;
    });
}
