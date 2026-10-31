import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import {
  IdGenerator,
  type Examples,
  type GherkinDocument,
  type Scenario,
  type Step,
  type Tag,
} from '@cucumber/messages';
import type { LintPolicy } from './lint-policy';

export type Severity = 'error' | 'warning';

export interface LintIssue {
  readonly uri: string;
  readonly line: number;
  readonly column: number;
  readonly severity: Severity;
  readonly rule: string;
  readonly message: string;
}

interface Location {
  readonly line: number;
  readonly column?: number;
}

interface ScenarioEntry {
  readonly scenario: Scenario;
  readonly inheritedTags: readonly string[];
}

const PLACEHOLDER = /<([^<>\s][^<>]*)>/g;

/** Lints one feature file against the project's tag and wording policy. Pure; no I/O. */
export function lintFeature(source: string, uri: string, policy: LintPolicy): LintIssue[] {
  const issues: LintIssue[] = [];
  const report = (at: Location, severity: Severity, rule: string, message: string): void => {
    issues.push({ uri, line: at.line, column: at.column ?? 1, severity, rule, message });
  };

  let document: GherkinDocument;
  try {
    document = new Parser(
      new AstBuilder(IdGenerator.incrementing()),
      new GherkinClassicTokenMatcher(),
    ).parse(source);
  } catch (error) {
    return parseErrors(error, uri);
  }

  const feature = document.feature;
  if (feature === undefined) {
    report({ line: 1 }, 'error', 'GL002', 'File does not contain a Feature');
    return issues;
  }
  if (feature.name.trim() === '') {
    report(feature.location, 'error', 'GL002', 'Feature must have a name');
  }
  checkTagsAreKnown(feature.tags, policy, report);

  const scenarios: ScenarioEntry[] = [];
  const featureTags = tagNames(feature.tags);
  for (const child of feature.children) {
    if (child.background !== undefined) {
      checkSteps(child.background.steps, policy, report);
    }
    if (child.scenario !== undefined) {
      scenarios.push({ scenario: child.scenario, inheritedTags: featureTags });
    }
    if (child.rule !== undefined) {
      checkTagsAreKnown(child.rule.tags, policy, report);
      const ruleTags = [...featureTags, ...tagNames(child.rule.tags)];
      for (const ruleChild of child.rule.children) {
        if (ruleChild.background !== undefined) {
          checkSteps(ruleChild.background.steps, policy, report);
        }
        if (ruleChild.scenario !== undefined) {
          scenarios.push({ scenario: ruleChild.scenario, inheritedTags: ruleTags });
        }
      }
    }
  }

  const seenNames = new Map<string, number>();
  for (const { scenario, inheritedTags } of scenarios) {
    const firstLine = seenNames.get(scenario.name);
    if (firstLine !== undefined) {
      report(
        scenario.location,
        'error',
        'GL008',
        `Duplicate scenario name "${scenario.name}" (first defined on line ${firstLine})`,
      );
    } else {
      seenNames.set(scenario.name, scenario.location.line);
    }
    lintScenario(scenario, inheritedTags, policy, report);
  }
  return issues;
}

type Reporter = (at: Location, severity: Severity, rule: string, message: string) => void;

function lintScenario(
  scenario: Scenario,
  inheritedTags: readonly string[],
  policy: LintPolicy,
  report: Reporter,
): void {
  if (scenario.steps.length === 0) {
    report(scenario.location, 'error', 'GL010', `Scenario "${scenario.name}" has no steps`);
  }
  checkTagsAreKnown(scenario.tags, policy, report);
  checkSteps(scenario.steps, policy, report);

  const scenarioTags = [...inheritedTags, ...tagNames(scenario.tags)];
  if (scenario.examples.length === 0) {
    checkRequiredTags(scenarioTags, scenario, policy, report);
  }
  for (const examples of scenario.examples) {
    checkTagsAreKnown(examples.tags, policy, report);
    checkRequiredTags([...scenarioTags, ...tagNames(examples.tags)], scenario, policy, report);
  }
  checkExamples(scenario, report);
}

function checkRequiredTags(
  tags: readonly string[],
  scenario: Scenario,
  policy: LintPolicy,
  report: Reporter,
): void {
  const exempt = tags.some((tag) => policy.typeTagExemptions.has(tag));
  if (!exempt && !tags.some((tag) => policy.typeTags.has(tag))) {
    report(
      scenario.location,
      'error',
      'GL003',
      `Scenario "${scenario.name}" needs a type tag: ${[...policy.typeTags].join(', ')}`,
    );
  }
  if (!tags.some((tag) => policy.intentTags.has(tag))) {
    report(
      scenario.location,
      'error',
      'GL004',
      `Scenario "${scenario.name}" needs an intent tag: ${[...policy.intentTags].join(', ')}`,
    );
  }
}

function checkTagsAreKnown(tags: readonly Tag[], policy: LintPolicy, report: Reporter): void {
  for (const tag of tags) {
    const known =
      policy.allowedTags.has(tag.name) ||
      policy.allowedTagPatterns.some((pattern) => pattern.test(tag.name));
    if (!known) {
      report(tag.location, 'error', 'GL005', `Unknown tag ${tag.name}; add it to the tag policy`);
    }
  }
}

function checkSteps(steps: readonly Step[], policy: LintPolicy, report: Reporter): void {
  for (const step of steps) {
    const text = stepContent(step);
    for (const rule of policy.forbiddenStepPatterns) {
      if (rule.regex.test(text)) {
        report(step.location, 'error', 'GL006', `${rule.message}: "${step.text}"`);
      }
    }
    for (const rule of policy.discouragedStepPatterns) {
      if (rule.regex.test(text)) {
        report(step.location, 'warning', 'GL007', `${rule.message}: "${step.text}"`);
      }
    }
  }
}

function checkExamples(scenario: Scenario, report: Reporter): void {
  const placeholders = new Set(
    scenario.steps.flatMap((step) =>
      [...stepContent(step).matchAll(PLACEHOLDER)].map((match) => match[1] ?? ''),
    ),
  );
  if (placeholders.size > 0 && scenario.examples.length === 0) {
    report(
      scenario.location,
      'error',
      'GL009',
      `Scenario "${scenario.name}" uses placeholders but has no Examples`,
    );
  }
  for (const examples of scenario.examples) {
    if (examples.tableBody.length === 0) {
      report(examples.location, 'error', 'GL009', 'Examples table has no data rows');
    }
    const columns = new Set(exampleColumns(examples));
    for (const placeholder of placeholders) {
      if (!columns.has(placeholder)) {
        report(
          examples.location,
          'error',
          'GL011',
          `Placeholder <${placeholder}> has no matching Examples column`,
        );
      }
    }
  }
}

function exampleColumns(examples: Examples): string[] {
  return examples.tableHeader?.cells.map((cell) => cell.value) ?? [];
}

function stepContent(step: Step): string {
  const tableText = step.dataTable?.rows.flatMap((row) => row.cells.map((cell) => cell.value));
  return [step.text, step.docString?.content ?? '', ...(tableText ?? [])].join('\n');
}

function tagNames(tags: readonly Tag[]): string[] {
  return tags.map((tag) => tag.name);
}

function parseErrors(error: unknown, uri: string): LintIssue[] {
  const message = error instanceof Error ? error.message : String(error);
  const issues = message
    .split('\n')
    .map((line) => /^\((\d+):(\d+)\): (.*)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match): LintIssue => ({
      uri,
      line: Number(match[1]),
      column: Number(match[2]),
      severity: 'error',
      rule: 'GL001',
      message: `Invalid Gherkin: ${match[3] ?? ''}`,
    }));
  return issues.length > 0
    ? issues
    : [{ uri, line: 1, column: 1, severity: 'error', rule: 'GL001', message }];
}
