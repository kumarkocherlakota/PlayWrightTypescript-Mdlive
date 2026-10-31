import { FAILURE_CATEGORIES, type FailureCategoryId } from '@core/failure-analysis';
import type { ClassifiedFailure, RunAnalysis, ScenarioReport } from './analyze-run';

/** Renders the analysis as a Markdown summary suitable for a CI job summary or PR comment. */
export function renderMarkdown(analysis: RunAnalysis): string {
  const { totals } = analysis;
  const lines = [
    '# Test run failure analysis',
    '',
    '| Scenarios | Passed | Failed | Flaky | Skipped | Incomplete |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${[totals.scenarios, totals.passed, totals.failed, totals.flaky, totals.skipped, totals.incomplete].join(' | ')} |`,
    '',
    'Categories are triage hints produced by rules, not verdicts. Always confirm with the evidence',
    'attached to the scenario (logs, screenshot, trace, API exchanges).',
  ];

  const categories = Object.entries(analysis.byCategory) as [FailureCategoryId, number][];
  if (categories.length > 0) {
    lines.push('', '## Failures by category', '', '| Category | Owner | Count |');
    lines.push('| --- | --- | --- |');
    for (const [id, count] of categories.sort((left, right) => right[1] - left[1])) {
      const category = FAILURE_CATEGORIES[id];
      lines.push(`| ${category.title} | ${category.owner} | ${String(count)} |`);
    }
  }

  section(lines, 'Failed scenarios', analysis.failed, (report) => report.failures.at(-1));
  section(lines, 'Flaky scenarios (passed on retry)', analysis.flaky, (report) =>
    report.failures.at(-1),
  );
  if (analysis.incomplete.length > 0) {
    lines.push('', '## Incomplete scenarios', '');
    lines.push('These attempts started but never reported a result (worker crash or abort).', '');
    for (const report of analysis.incomplete) {
      lines.push(`- ${escapeInline(report.scenario)} (\`${report.uri}\`)`);
    }
  }
  if (totals.failed === 0 && totals.flaky === 0 && totals.incomplete === 0) {
    lines.push('', 'No failures were recorded.');
  }
  return `${lines.join('\n')}\n`;
}

function section(
  lines: string[],
  heading: string,
  reports: readonly ScenarioReport[],
  pick: (report: ScenarioReport) => ClassifiedFailure | undefined,
): void {
  if (reports.length === 0) {
    return;
  }
  lines.push('', `## ${heading}`, '');
  for (const report of reports) {
    const failure = pick(report);
    lines.push(`### ${escapeInline(report.scenario)}`, '');
    lines.push(`- Location: \`${report.uri}\``);
    lines.push(`- Attempts: ${String(report.attempts)}`);
    if (failure !== undefined) {
      lines.push(`- Category: **${failure.title}** (owner: ${failure.owner})`);
      lines.push(`- Why: ${failure.reason}`);
      lines.push(`- Next step: ${failure.guidance}`);
      lines.push(`- Failing step: ${escapeInline(failure.step)}`);
      if (failure.message !== undefined) {
        lines.push('', '```text', failure.message.replaceAll('```', "'''"), '```');
      }
    }
    lines.push('');
  }
}

function escapeInline(text: string): string {
  return text.replace(/[|<>]/g, (character) => `\\${character}`);
}
