/**
 * Adds the last run (reports/cucumber/messages.ndjson) to the flakiness history and rewrites
 * reports/flakiness/flakiness-report.{json,md}. The test runner does this after every run.
 *
 *   node --import tsx tools/flakiness/cli.ts [browser]
 */
import path from 'node:path';
import { REPORT_PATHS } from '../run/report-paths';
import { recordRunAndReport } from './write-flakiness';

recordRunAndReport(
  {
    messagesFile: path.resolve(REPORT_PATHS.cucumberMessages),
    directory: path.resolve(REPORT_PATHS.flakinessDirectory),
  },
  process.argv[2] ?? 'chromium',
)
  .then(({ report, markdownFile }) => {
    console.log(
      `Flakiness: ${String(report.unstable.length)} unstable of ${String(report.scenariosAnalysed)} over ${String(report.runsAnalysed)} runs. Written to ${path.relative(process.cwd(), markdownFile)}`,
    );
  })
  .catch((error: unknown) => {
    console.error('Flakiness report could not be produced:', error);
    process.exitCode = 2;
  });
