import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lintAgentDefinition,
  REQUIRED_SECTIONS,
} from '../../../tools/agents/lint-agent-definition';

function definition(options: { name?: string; readonly?: boolean; mayModify?: string } = {}) {
  const sections = REQUIRED_SECTIONS.map((section) => {
    if (section === 'Files it may modify') {
      return `## ${section}\n\n${options.mayModify ?? '- `docs/**`'}`;
    }
    if (section === 'Never fabricate') {
      return `## ${section}\n\nNever invent requirements, locators, API responses, execution results, test results or domain rules.`;
    }
    return `## ${section}\n\nSomething specific.`;
  });
  return [
    '---',
    `name: ${options.name ?? 'code-review'}`,
    'description: Reviews a diff against the project rules before merging.',
    'model: inherit',
    `readonly: ${String(options.readonly ?? false)}`,
    '---',
    '',
    '# Agent',
    '',
    ...sections,
    '',
  ].join('\n');
}

describe('lintAgentDefinition', () => {
  it('accepts a complete definition', () => {
    assert.deepEqual(lintAgentDefinition('code-review.md', definition()), []);
  });

  it('requires frontmatter and a name that matches the file', () => {
    assert.deepEqual(lintAgentDefinition('x.md', '# No frontmatter'), [
      'x.md: missing YAML frontmatter delimited by "---" lines',
    ]);
    assert.deepEqual(lintAgentDefinition('other.md', definition()), [
      'other.md: "name" is "code-review" but the file name says "other"',
    ]);
  });

  it('reports missing sections and sections out of order', () => {
    const withoutEscalation = definition().replace(
      /## Escalation rules\n\nSomething specific\./,
      '',
    );
    assert.deepEqual(lintAgentDefinition('code-review.md', withoutEscalation), [
      'code-review.md: section "## Escalation rules" is missing or empty',
    ]);
    const swapped = definition()
      .replace('## Responsibility', '## TEMP')
      .replace('## Input contract', '## Responsibility')
      .replace('## TEMP', '## Input contract');
    assert.match(
      lintAgentDefinition('code-review.md', swapped).join('\n'),
      /sections must appear in this order/,
    );
  });

  it('requires every never-fabricate item', () => {
    const partial = definition().replace(', test results or domain rules', '');
    assert.deepEqual(lintAgentDefinition('code-review.md', partial), [
      'code-review.md: "Never fabricate" does not mention: test results, domain rules',
    ]);
  });

  it('keeps readonly consistent with the files an agent may modify', () => {
    assert.deepEqual(lintAgentDefinition('code-review.md', definition({ readonly: true })), [
      'code-review.md: a readonly agent must list "None." under "Files it may modify"',
    ]);
    assert.deepEqual(lintAgentDefinition('code-review.md', definition({ mayModify: 'None.' })), [
      'code-review.md: an agent that modifies nothing must be readonly: true',
    ]);
  });
});
