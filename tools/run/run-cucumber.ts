/**
 * Single entry point for test runs:
 *   node --import tsx tools/run/run-cucumber.ts [cucumber arguments]
 *
 * 1. Clears raw results of the previous run so reports describe only this run.
 * 2. For TEST_ENV=local only: when TEST_USER_EMAIL and TEST_USER_PASSWORD are both unset,
 *    generates throwaway synthetic values for the local reference app. They are passed only to
 *    the Cucumber child process and are never printed or written to disk.
 * 3. Runs Cucumber, then always writes the failure analysis and the traceability matrix with
 *    this run's execution results, whether the run passed or failed.
 * The exit code is Cucumber's; a missing analysis or matrix turns a passing run into exit code 2.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { describeTotals, writeAnalysis } from '../failure-analysis/write-analysis';
import { defaultTraceabilityPaths, writeMatrices } from '../traceability/write-matrix';
import { REPORT_PATHS } from './report-paths';

const env: Record<string, string | undefined> = { ...process.env };

if (env.TEST_ENV === 'local') {
  const hasEmail = (env.TEST_USER_EMAIL ?? '') !== '';
  const hasPassword = (env.TEST_USER_PASSWORD ?? '') !== '';
  if (hasEmail !== hasPassword) {
    console.error('Set both TEST_USER_EMAIL and TEST_USER_PASSWORD, or neither.');
    process.exit(2);
  }
  if (!hasEmail) {
    env.TEST_USER_EMAIL = `synthetic.${randomBytes(4).toString('hex')}@example.test`;
    env.TEST_USER_PASSWORD = `Syn-${randomBytes(18).toString('base64url')}!9`;
    console.log('Using a generated synthetic test user for the local reference app.');
  }
}

async function main(): Promise<void> {
  await Promise.all(
    [
      REPORT_PATHS.allureResults,
      REPORT_PATHS.cucumberMessages,
      REPORT_PATHS.analysisDirectory,
      REPORT_PATHS.traceabilityDirectory,
    ].map((target) => rm(path.resolve(target), { recursive: true, force: true })),
  );

  const exitCode = await runCucumber(process.argv.slice(2));

  try {
    const { analysis, markdownFile } = await writeAnalysis({
      messagesFile: path.resolve(REPORT_PATHS.cucumberMessages),
      outputDirectory: path.resolve(REPORT_PATHS.analysisDirectory),
      allureResultsDirectory: path.resolve(REPORT_PATHS.allureResults),
    });
    console.log(`\nFailure analysis: ${describeTotals(analysis)}`);
    console.log(`Written to ${path.relative(process.cwd(), markdownFile)}`);
    process.exitCode = exitCode;
  } catch (error: unknown) {
    console.error('Failure analysis could not be produced:', error);
    process.exitCode = exitCode === 0 ? 2 : exitCode;
  }
  await writeRunTraceability(exitCode);
}

/** The committed matrix is left untouched here; only the run report is written. */
async function writeRunTraceability(exitCode: number): Promise<void> {
  const root = process.cwd();
  try {
    const { reportFile } = await writeMatrices(defaultTraceabilityPaths(root), {
      updateCommittedMatrix: false,
    });
    if (reportFile !== undefined) {
      console.log(`Traceability with execution results: ${path.relative(root, reportFile)}`);
    }
  } catch (error: unknown) {
    console.error('Traceability matrix could not be produced:', error);
    process.exitCode = exitCode === 0 ? 2 : exitCode;
  }
}

function runCucumber(args: readonly string[]): Promise<number> {
  const cucumberBin = path.join(
    path.dirname(require.resolve('@cucumber/cucumber/package.json')),
    'bin',
    'cucumber.js',
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cucumberBin, ...args], { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve(code ?? (signal === null ? 1 : 128));
    });
  });
}

main().catch((error: unknown) => {
  console.error('Test run failed to start:', error);
  process.exitCode = 2;
});
