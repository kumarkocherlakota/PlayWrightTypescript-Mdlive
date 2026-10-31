/**
 * Requirement → acceptance criterion → scenario → result traceability:
 *   node --import tsx tools/traceability/cli.ts generate   write the committed matrix and,
 *                                                          after a run, the run report
 *   node --import tsx tools/traceability/cli.ts check      fail on broken links or a stale
 *                                                          committed matrix (used by validate)
 * Exit code 1 when the check fails, 2 when the matrix could not be produced.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultTraceabilityPaths, expectedCommittedMatrix, writeMatrices } from './write-matrix';

const root = process.cwd();
const paths = defaultTraceabilityPaths(root);

async function generate(): Promise<void> {
  const { matrix, reportFile } = await writeMatrices(paths);
  const { criteria } = matrix.coverage;
  console.log(
    `Traceability: ${criteria.automated}/${criteria.total} acceptance criteria covered by automated scenarios.`,
  );
  console.log(`Written to ${path.relative(root, paths.committedMatrix)}`);
  if (reportFile !== undefined) {
    console.log(`Run report with execution results: ${path.relative(root, reportFile)}`);
  }
  reportIssues(matrix.issues);
}

async function check(): Promise<void> {
  const { matrix, markdown } = await expectedCommittedMatrix(paths);
  const committed = await readFile(paths.committedMatrix, 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  });
  const stale = committed !== markdown;
  if (stale) {
    console.error(
      `${path.relative(root, paths.committedMatrix)} is out of date. Run "npm run traceability" and commit the result.`,
    );
  }
  reportIssues(matrix.issues);
  if (stale || matrix.issues.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(`Traceability check: ${matrix.rows.length} links, no issues.`);
}

function reportIssues(issues: readonly string[]): void {
  for (const issue of issues) {
    console.error(`Traceability issue: ${issue}`);
  }
  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

const MODES: Readonly<Record<string, () => Promise<void>>> = { generate, check };
const mode = process.argv[2] ?? 'generate';
const run = MODES[mode];
if (run === undefined) {
  console.error(`Unknown mode "${mode}". Use "generate" or "check".`);
  process.exitCode = 2;
} else {
  run().catch((error: unknown) => {
    console.error('Traceability matrix could not be produced:', error);
    process.exitCode = 2;
  });
}
