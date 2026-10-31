/**
 * Single entry point for test runs:
 *   node --import tsx tools/run/run-cucumber.ts [cucumber arguments]
 *
 * 1. Clears raw results of the previous run so reports describe only this run.
 * 2. For TEST_ENV=local only: generates throwaway synthetic values for the local reference app
 *    when a credential pair is unset (TEST_USER_EMAIL / TEST_USER_PASSWORD, and the service
 *    client API_CLIENT_ID / API_CLIENT_SECRET). They are passed only to the Cucumber child
 *    process and are never printed or written to disk.
 * 3. Runs Cucumber, then always writes the failure analysis, the traceability matrix with this
 *    run's execution results and the flakiness history, whether the run passed or failed.
 * 4. Scans the reports for unredacted secrets and personal data, including this run's actual
 *    secret values. Findings print location and kind only.
 * The exit code is Cucumber's; a missing analysis, matrix or flakiness report turns a passing run
 * into exit code 2, and a leak finding into exit code 1.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { describeTotals, writeAnalysis } from '../failure-analysis/write-analysis';
import { recordRunAndReport } from '../flakiness/write-flakiness';
import { describeFindings, scanReportDirectory } from '../security/report-leak-scanner';
import { defaultTraceabilityPaths, writeMatrices } from '../traceability/write-matrix';
import { REPORT_PATHS } from './report-paths';

const env: Record<string, string | undefined> = { ...process.env };

if (env.TEST_ENV === 'local') {
  provideSyntheticPair('TEST_USER_EMAIL', 'TEST_USER_PASSWORD', 'test user', () => [
    `synthetic.${randomBytes(4).toString('hex')}@example.test`,
    `Syn-${randomBytes(18).toString('base64url')}!9`,
  ]);
  provideSyntheticPair('API_CLIENT_ID', 'API_CLIENT_SECRET', 'service client', () => [
    `synthetic-client-${randomBytes(4).toString('hex')}`,
    randomBytes(24).toString('base64url'),
  ]);
}

/** Sets both variables when neither is set; a half-configured pair stops the run. */
function provideSyntheticPair(
  first: string,
  second: string,
  label: string,
  generate: () => readonly [string, string],
): void {
  const hasFirst = (env[first] ?? '') !== '';
  const hasSecond = (env[second] ?? '') !== '';
  if (hasFirst !== hasSecond) {
    console.error(`Set both ${first} and ${second}, or neither.`);
    process.exit(2);
  }
  if (!hasFirst) {
    [env[first], env[second]] = generate();
    console.log(`Using a generated synthetic ${label} for the local reference app.`);
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
  await recordFlakiness(exitCode);
  await scanReportsForLeaks(exitCode);
}

const SECRET_VARIABLES = ['TEST_USER_EMAIL', 'TEST_USER_PASSWORD', 'API_CLIENT_SECRET', 'API_KEY'];

async function scanReportsForLeaks(exitCode: number): Promise<void> {
  const knownSecrets = SECRET_VARIABLES.map((name) => env[name] ?? '').filter(
    (value) => value !== '',
  );
  const directories = new Set([
    path.resolve('reports'),
    path.resolve(env.ARTIFACTS_DIR ?? 'reports'),
  ]);
  try {
    for (const directory of directories) {
      const result = await scanReportDirectory(directory, { knownSecrets });
      console.log(describeFindings(result));
      if (result.findings.length > 0 && exitCode === 0) {
        process.exitCode = 1;
      }
    }
  } catch (error: unknown) {
    console.error('Report leak scan could not run:', error);
    process.exitCode = exitCode === 0 ? 2 : exitCode;
  }
}

async function recordFlakiness(exitCode: number): Promise<void> {
  try {
    const { report, markdownFile } = await recordRunAndReport(
      {
        messagesFile: path.resolve(REPORT_PATHS.cucumberMessages),
        directory: path.resolve(REPORT_PATHS.flakinessDirectory),
      },
      env.BROWSER ?? 'chromium',
    );
    console.log(
      `Flakiness over ${String(report.runsAnalysed)} recorded runs: ${String(report.unstable.length)} unstable (${path.relative(process.cwd(), markdownFile)})`,
    );
  } catch (error: unknown) {
    console.error('Flakiness report could not be produced:', error);
    process.exitCode = exitCode === 0 ? 2 : exitCode;
  }
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
