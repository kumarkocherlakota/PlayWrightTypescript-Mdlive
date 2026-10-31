import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const REQUIREMENT_ID = /^REQ-[A-Z]+-\d{3}$/;
const CRITERION_ID = /^AC-[A-Z]+-\d{3}\.\d+$/;

const catalogueSchema = z.strictObject({
  description: z.string().min(1),
  requirements: z
    .array(
      z.strictObject({
        id: z.string().regex(REQUIREMENT_ID),
        title: z.string().min(1),
        statement: z.string().min(1),
        acceptanceCriteria: z
          .array(z.strictObject({ id: z.string().regex(CRITERION_ID), text: z.string().min(1) }))
          .min(1),
      }),
    )
    .min(1),
});

export type RequirementsCatalogue = z.infer<typeof catalogueSchema>;
export type Requirement = RequirementsCatalogue['requirements'][number];
export type AcceptanceCriterion = Requirement['acceptanceCriteria'][number];

/** `AC-APPT-001.2` → `REQ-APPT-001`. */
export function requirementIdOf(criterionId: string): string {
  return criterionId.replace(/^AC-/, 'REQ-').replace(/\.\d+$/, '');
}

/**
 * Validates the catalogue: schema, unique IDs, and every criterion numbered under its own
 * requirement. Throws with all problems at once.
 */
export function parseCatalogue(json: unknown): RequirementsCatalogue {
  const catalogue = catalogueSchema.parse(json);
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const requirement of catalogue.requirements) {
    for (const id of [requirement.id, ...requirement.acceptanceCriteria.map((each) => each.id)]) {
      if (seen.has(id)) {
        problems.push(`${id} is defined more than once`);
      }
      seen.add(id);
    }
    for (const criterion of requirement.acceptanceCriteria) {
      if (requirementIdOf(criterion.id) !== requirement.id) {
        problems.push(`${criterion.id} is listed under ${requirement.id}`);
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`Requirements catalogue is invalid: ${problems.join('; ')}.`);
  }
  return catalogue;
}

export async function loadCatalogue(file: string): Promise<RequirementsCatalogue> {
  return parseCatalogue(JSON.parse(await readFile(file, 'utf8')) as unknown);
}
