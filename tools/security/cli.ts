/**
 * Scans the reports of the last run for unredacted secrets, tokens and personal data.
 *
 *   node --import tsx tools/security/cli.ts [reportsDir]
 *
 * Exit code 1 when anything is found, 2 when the scan cannot run. The test runner also runs this
 * scan after every run, with the run's actual secret values; standalone, only patterns apply.
 */
import path from 'node:path';
import { describeFindings, scanReportDirectory } from './report-leak-scanner';

const reportsDirectory = path.resolve(process.argv[2] ?? 'reports');

scanReportDirectory(reportsDirectory)
  .then((result) => {
    console.log(describeFindings(result));
    process.exitCode = result.findings.length > 0 ? 1 : 0;
  })
  .catch((error: unknown) => {
    console.error('Report leak scan could not run:', error);
    process.exitCode = 2;
  });
