/**
 * Fails when a step definition is not used by any feature file. Reads Cucumber `usage-json`
 * output produced by `npm run bdd:unused`.
 *
 *   node --import tsx tools/bdd/unused-steps.ts reports/bdd/usage.json
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const usageSchema = z.array(
  z.object({
    pattern: z.string(),
    uri: z.string(),
    line: z.number(),
    matches: z.array(z.unknown()),
  }),
);

const file = process.argv[2];
if (file === undefined) {
  console.error('Usage: unused-steps.ts <usage-json file>');
  process.exit(2);
}

const definitions = usageSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
const unused = definitions.filter((definition) => definition.matches.length === 0);

for (const definition of unused) {
  console.log(`${definition.uri}:${definition.line}  unused step: ${definition.pattern}`);
}
console.log(`\nStep definitions: ${definitions.length} total, ${unused.length} unused.`);
process.exitCode = unused.length > 0 ? 1 : 0;
