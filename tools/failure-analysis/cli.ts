/**
 * Classifies the failures of a finished run:
 *   node --import tsx tools/failure-analysis/cli.ts [messages.ndjson] [output-directory]
 * Exit code 0 when the analysis was written (whatever the run result), 2 when it could not be.
 */
import path from 'node:path';
import { REPORT_PATHS } from '../run/report-paths';
import { describeTotals, writeAnalysis } from './write-analysis';

const [messagesArgument, outputArgument] = process.argv.slice(2);

writeAnalysis({
  messagesFile: path.resolve(messagesArgument ?? REPORT_PATHS.cucumberMessages),
  outputDirectory: path.resolve(outputArgument ?? REPORT_PATHS.analysisDirectory),
  allureResultsDirectory: path.resolve(REPORT_PATHS.allureResults),
})
  .then(({ analysis, markdownFile }) => {
    console.log(`Failure analysis: ${describeTotals(analysis)}`);
    console.log(`Written to ${path.relative(process.cwd(), markdownFile)}`);
  })
  .catch((error: unknown) => {
    console.error('Failure analysis could not be produced:', error);
    process.exitCode = 2;
  });
