import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, type GherkinDocument } from '@cucumber/messages';

export type AutomationLayer = 'UI' | 'API' | 'UI + API' | 'Unspecified';
export type ScenarioMode = 'automated' | 'manual' | 'blocked';

export const INTENTS = ['positive', 'negative', 'boundary', 'security', 'accessibility'] as const;
export type Intent = (typeof INTENTS)[number];

/** One executable scenario (an outline contributes one per Examples row). */
export interface TracedScenario {
  /** `<feature path>:<line>`; the line of the scenario, or of its Examples row. */
  readonly location: string;
  readonly uri: string;
  readonly feature: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly requirementIds: readonly string[];
  readonly criterionIds: readonly string[];
  readonly layer: AutomationLayer;
  readonly intents: readonly Intent[];
  readonly mode: ScenarioMode;
  readonly defects: readonly string[];
}

/** Maps every scenario and Examples-row AST node ID to its line. */
export function astNodeLines(document: GherkinDocument): Map<string, number> {
  const lines = new Map<string, number>();
  const children = document.feature?.children ?? [];
  const scenarios = children.flatMap((child) => [
    ...(child.scenario ? [child.scenario] : []),
    ...(child.rule?.children ?? []).flatMap((ruleChild) =>
      ruleChild.scenario ? [ruleChild.scenario] : [],
    ),
  ]);
  for (const scenario of scenarios) {
    lines.set(scenario.id, scenario.location.line);
    for (const row of scenario.examples.flatMap((examples) => examples.tableBody)) {
      lines.set(row.id, row.location.line);
    }
  }
  return lines;
}

/** The location of a pickle: its Examples row when it has one, otherwise its scenario. */
export function pickleLocation(
  uri: string,
  astNodeIds: readonly string[],
  lines: ReadonlyMap<string, number>,
): string {
  const line = [...astNodeIds]
    .reverse()
    .map((id) => lines.get(id))
    .find((each) => each !== undefined);
  return `${uri}:${line ?? 0}`;
}

export function parseFeature(source: string, uri: string): GherkinDocument {
  const document = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  ).parse(source);
  return { ...document, uri };
}

/** Expands a feature into traced scenarios with inherited tags. Pure; no I/O. */
export function collectScenarios(source: string, uri: string): TracedScenario[] {
  const document = parseFeature(source, uri);
  const feature = document.feature?.name ?? uri;
  const lines = astNodeLines(document);
  return compile(document, uri, IdGenerator.incrementing()).map((pickle) => {
    const tags = pickle.tags.map((tag) => tag.name);
    return {
      location: pickleLocation(uri, pickle.astNodeIds, lines),
      uri,
      feature,
      name: pickle.name,
      tags,
      requirementIds: matching(tags, /^@(REQ-[A-Z]+-\d{3})$/),
      criterionIds: matching(tags, /^@(AC-[A-Z]+-\d{3}(?:\.\d+)?)$/),
      layer: layerOf(tags),
      intents: INTENTS.filter((intent) => tags.includes(`@${intent}`)),
      mode: tags.includes('@blocked')
        ? 'blocked'
        : tags.includes('@manual')
          ? 'manual'
          : 'automated',
      defects: matching(tags, /^@(DEF-[A-Za-z0-9-]+)$/),
    };
  });
}

function matching(tags: readonly string[], pattern: RegExp): string[] {
  return [...new Set(tags.flatMap((tag) => pattern.exec(tag)?.[1] ?? []))];
}

function layerOf(tags: readonly string[]): AutomationLayer {
  if (tags.includes('@integration')) {
    return 'UI + API';
  }
  if (tags.includes('@ui')) {
    return 'UI';
  }
  return tags.includes('@api') ? 'API' : 'Unspecified';
}
