import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { parseEnvelopes } from '../failure-analysis/scenario-attempts';
import { REPORT_PATHS } from '../run/report-paths';
import { buildMatrix, type TraceabilityMatrix } from './build-matrix';
import { collectScenarios, type TracedScenario } from './collect-scenarios';
import { resultsFromRun, type RunResults } from './execution-results';
import { renderMatrix } from './render-matrix';
import { loadCatalogue } from './requirements-catalogue';

export interface TraceabilityPaths {
  readonly root: string;
  readonly featuresDirectory: string;
  readonly catalogueFile: string;
  /** Committed matrix without execution results. */
  readonly committedMatrix: string;
  readonly reportDirectory: string;
  readonly messagesFile: string;
}

/** Project locations of the catalogue, the features, the committed matrix and the run report. */
export function defaultTraceabilityPaths(root: string): TraceabilityPaths {
  return {
    root,
    featuresDirectory: path.join(root, 'features'),
    catalogueFile: path.join(root, 'docs/traceability/requirements/healthcare-requirements.json'),
    committedMatrix: path.join(root, 'docs/traceability/traceability-matrix.md'),
    reportDirectory: path.resolve(root, REPORT_PATHS.traceabilityDirectory),
    messagesFile: path.resolve(root, REPORT_PATHS.cucumberMessages),
  };
}

export async function loadScenarios(
  root: string,
  featuresDirectory: string,
): Promise<TracedScenario[]> {
  const files = (await readdir(featuresDirectory, { recursive: true }))
    .filter((file) => file.endsWith('.feature'))
    .sort();
  const scenarios: TracedScenario[] = [];
  for (const file of files) {
    const absolute = path.join(featuresDirectory, file);
    const uri = path.relative(root, absolute).split(path.sep).join('/');
    scenarios.push(...collectScenarios(await readFile(absolute, 'utf8'), uri));
  }
  return scenarios;
}

/** Results of the last recorded run, or undefined when no run has been recorded. */
export async function loadRunResults(messagesFile: string): Promise<RunResults | undefined> {
  const text = await readFile(messagesFile, 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  });
  return text === undefined ? undefined : resultsFromRun(parseEnvelopes(text));
}

async function formatted(markdown: string, file: string): Promise<string> {
  const options = (await resolveConfig(file)) ?? {};
  return format(markdown, { ...options, filepath: file });
}

/** Builds the matrix from the catalogue and features, joined with run results when given. */
export async function traceabilityMatrix(
  paths: TraceabilityPaths,
  run?: RunResults,
): Promise<TraceabilityMatrix> {
  const catalogue = await loadCatalogue(paths.catalogueFile);
  return buildMatrix(catalogue, await loadScenarios(paths.root, paths.featuresDirectory), run);
}

/** The committed matrix as it should currently read (no execution results). */
export async function expectedCommittedMatrix(
  paths: TraceabilityPaths,
): Promise<{ matrix: TraceabilityMatrix; markdown: string }> {
  const matrix = await traceabilityMatrix(paths);
  const markdown = renderMatrix(matrix, {
    withResults: false,
    catalogueFile: path.relative(paths.root, paths.catalogueFile),
  });
  return { matrix, markdown: await formatted(markdown, paths.committedMatrix) };
}

/**
 * Writes the committed matrix (unless `updateCommittedMatrix` is false) and, when a run was
 * recorded, the run report with execution results (Markdown and JSON) under the report directory.
 */
export async function writeMatrices(
  paths: TraceabilityPaths,
  options: { readonly updateCommittedMatrix: boolean } = { updateCommittedMatrix: true },
): Promise<{ matrix: TraceabilityMatrix; reportFile: string | undefined }> {
  const { matrix, markdown } = await expectedCommittedMatrix(paths);
  if (options.updateCommittedMatrix) {
    await writeFile(paths.committedMatrix, markdown);
  }

  const run = await loadRunResults(paths.messagesFile);
  if (run === undefined) {
    return { matrix, reportFile: undefined };
  }
  const withResults = await traceabilityMatrix(paths, run);
  await mkdir(paths.reportDirectory, { recursive: true });
  const reportFile = path.join(paths.reportDirectory, 'traceability-matrix.md');
  const report = renderMatrix(withResults, {
    withResults: true,
    catalogueFile: path.relative(paths.root, paths.catalogueFile),
  });
  await writeFile(reportFile, await formatted(report, reportFile));
  await writeFile(
    path.join(paths.reportDirectory, 'traceability-matrix.json'),
    `${JSON.stringify(
      {
        runStartedAt: withResults.runStartedAt,
        coverage: withResults.coverage,
        issues: withResults.issues,
        rows: withResults.rows,
      },
      null,
      2,
    )}\n`,
  );
  return { matrix: withResults, reportFile };
}
