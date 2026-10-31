/** Sections every agent definition must contain, in this order. */
export const REQUIRED_SECTIONS = [
  'Responsibility',
  'Input contract',
  'Output structure',
  'Restrictions',
  'Escalation rules',
  'Files it may modify',
  'Files it must not modify',
  'Validation checklist',
  'Never fabricate',
] as const;

/** What every agent must refuse to invent (ARCHITECTURE section 7). */
export const NEVER_FABRICATE = [
  'requirements',
  'locators',
  'API responses',
  'execution results',
  'test results',
  'domain rules',
] as const;

const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Checks one `.cursor/agents/<name>.md` definition against the Cursor subagent format
 * (frontmatter `name`, `description`, `model`, `readonly`) and the framework's agent contract.
 * Returns one message per problem; an empty list means the definition is valid.
 */
export function lintAgentDefinition(fileName: string, text: string): string[] {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) {
    return [`${fileName}: missing YAML frontmatter delimited by "---" lines`];
  }
  const frontmatter = parseFrontmatter(match[1] ?? '');
  const body = match[2] ?? '';
  return [
    ...frontmatterProblems(fileName, frontmatter),
    ...sectionProblems(body),
    ...modificationProblems(frontmatter, body),
  ].map((problem) => `${fileName}: ${problem}`);
}

function parseFrontmatter(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split('\n')) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return fields;
}

function frontmatterProblems(fileName: string, fields: Map<string, string>): string[] {
  const problems: string[] = [];
  const name = fields.get('name');
  const expected = fileName.replace(/\.md$/, '');
  if (name === undefined || !NAME_PATTERN.test(name)) {
    problems.push('"name" must be lowercase words joined by hyphens');
  } else if (name !== expected) {
    problems.push(`"name" is "${name}" but the file name says "${expected}"`);
  }
  if ((fields.get('description') ?? '').length < 20) {
    problems.push('"description" must say when to delegate to the agent');
  }
  if ((fields.get('model') ?? '') === '') {
    problems.push('"model" must be set ("inherit" or a model ID)');
  }
  const readonly = fields.get('readonly');
  if (readonly !== 'true' && readonly !== 'false') {
    problems.push('"readonly" must be true or false');
  }
  return problems;
}

function sectionsOf(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = body.split(/^## /m).slice(1);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    sections.set(title, newline === -1 ? '' : part.slice(newline + 1).trim());
  }
  return sections;
}

function sectionProblems(body: string): string[] {
  const sections = sectionsOf(body);
  const problems: string[] = [];
  const present = [...sections.keys()].filter((title) =>
    (REQUIRED_SECTIONS as readonly string[]).includes(title),
  );
  for (const section of REQUIRED_SECTIONS) {
    if ((sections.get(section) ?? '') === '') {
      problems.push(`section "## ${section}" is missing or empty`);
    }
  }
  const expectedOrder = REQUIRED_SECTIONS.filter((section) => present.includes(section));
  if (problems.length === 0 && present.join('|') !== expectedOrder.join('|')) {
    problems.push(`sections must appear in this order: ${REQUIRED_SECTIONS.join(', ')}`);
  }
  const never = (sections.get('Never fabricate') ?? '').replace(/\s+/g, ' ').toLowerCase();
  const missing = NEVER_FABRICATE.filter((item) => !never.includes(item.toLowerCase()));
  if (never !== '' && missing.length > 0) {
    problems.push(`"Never fabricate" does not mention: ${missing.join(', ')}`);
  }
  return problems;
}

function modificationProblems(fields: Map<string, string>, body: string): string[] {
  const mayModify = sectionsOf(body).get('Files it may modify') ?? '';
  if (fields.get('readonly') === 'true' && mayModify !== 'None.') {
    return ['a readonly agent must list "None." under "Files it may modify"'];
  }
  if (fields.get('readonly') === 'false' && mayModify === 'None.') {
    return ['an agent that modifies nothing must be readonly: true'];
  }
  return [];
}
