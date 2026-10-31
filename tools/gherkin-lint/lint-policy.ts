import { readFileSync } from 'node:fs';
import { z } from 'zod';

const tag = z.string().regex(/^@[\w.-]+$/, 'tags start with @');
const regexSource = z
  .string()
  .refine(isValidRegex, { error: 'must be a valid regular expression' });
const stepPattern = z.strictObject({ pattern: regexSource, message: z.string().min(1) });

const policySchema = z.strictObject({
  typeTags: z.array(tag).min(1),
  intentTags: z.array(tag).min(1),
  typeTagExemptions: z.array(tag),
  allowedTags: z.array(tag),
  allowedTagPatterns: z.array(regexSource),
  forbiddenStepPatterns: z.array(stepPattern),
  discouragedStepPatterns: z.array(stepPattern),
});

export type LintPolicyDefinition = z.infer<typeof policySchema>;

export interface StepRule {
  readonly regex: RegExp;
  readonly message: string;
}

/** Validated policy with compiled regular expressions. */
export interface LintPolicy {
  readonly typeTags: ReadonlySet<string>;
  readonly intentTags: ReadonlySet<string>;
  readonly typeTagExemptions: ReadonlySet<string>;
  readonly allowedTags: ReadonlySet<string>;
  readonly allowedTagPatterns: readonly RegExp[];
  readonly forbiddenStepPatterns: readonly StepRule[];
  readonly discouragedStepPatterns: readonly StepRule[];
}

export function compilePolicy(definition: unknown): LintPolicy {
  const parsed = policySchema.parse(definition);
  const compileRule = (rule: { pattern: string; message: string }): StepRule => ({
    regex: new RegExp(rule.pattern, 'i'),
    message: rule.message,
  });
  return {
    typeTags: new Set(parsed.typeTags),
    intentTags: new Set(parsed.intentTags),
    typeTagExemptions: new Set(parsed.typeTagExemptions),
    allowedTags: new Set([
      ...parsed.typeTags,
      ...parsed.intentTags,
      ...parsed.typeTagExemptions,
      ...parsed.allowedTags,
    ]),
    allowedTagPatterns: parsed.allowedTagPatterns.map((source) => new RegExp(source)),
    forbiddenStepPatterns: parsed.forbiddenStepPatterns.map(compileRule),
    discouragedStepPatterns: parsed.discouragedStepPatterns.map(compileRule),
  };
}

export function loadPolicy(file: string): LintPolicy {
  return compilePolicy(JSON.parse(readFileSync(file, 'utf8')));
}

function isValidRegex(source: string): boolean {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}
