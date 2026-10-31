/**
 * Gherkin linter: invalid Gherkin, missing/unknown tags, selectors and fixed waits in steps,
 * duplicate scenarios, empty scenarios and broken Scenario Outlines.
 *
 *   node --import tsx tools/gherkin-lint/cli.ts [featuresDir] [policyFile]
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintFeature, type LintIssue } from './lint-feature';
import { loadPolicy } from './lint-policy';

const featuresDirectory = path.resolve(process.argv[2] ?? 'features');
const policyFile = path.resolve(process.argv[3] ?? 'config/gherkin-lint.json');

const policy = loadPolicy(policyFile);
const files = readdirSync(featuresDirectory, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.feature'))
  .sort();

const issues: LintIssue[] = files.flatMap((file) => {
  const absolute = path.join(featuresDirectory, file);
  const uri = path.relative(process.cwd(), absolute);
  return lintFeature(readFileSync(absolute, 'utf8'), uri, policy);
});

for (const issue of issues) {
  console.log(
    `${issue.uri}:${issue.line}:${issue.column}  ${issue.severity.padEnd(7)} ${issue.rule}  ${issue.message}`,
  );
}

const errors = issues.filter((issue) => issue.severity === 'error').length;
const warnings = issues.length - errors;
console.log(
  `\nGherkin lint: ${files.length} feature files, ${errors} errors, ${warnings} warnings.`,
);
process.exitCode = errors > 0 || files.length === 0 ? 1 : 0;
