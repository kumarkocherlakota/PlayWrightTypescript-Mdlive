/**
 * Validates the Cursor agent definitions in `.cursor/agents`.
 *
 *   node --import tsx tools/agents/cli.ts [agentsDir]
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintAgentDefinition } from './lint-agent-definition';

const agentsDirectory = path.resolve(process.argv[2] ?? '.cursor/agents');
const files = readdirSync(agentsDirectory)
  .filter((file) => file.endsWith('.md'))
  .sort();

const problems = files.flatMap((file) =>
  lintAgentDefinition(file, readFileSync(path.join(agentsDirectory, file), 'utf8')),
);
for (const problem of problems) {
  console.log(problem);
}
console.log(`\nAgent lint: ${files.length} agent definitions, ${problems.length} problems.`);
process.exitCode = problems.length > 0 || files.length === 0 ? 1 : 0;
