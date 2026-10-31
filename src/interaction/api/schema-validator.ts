import { Ajv, type ErrorObject, type JSONSchemaType, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from '@core/errors';

/** A JSON Schema whose shape TypeScript checks against `T`, so schema and model cannot drift. */
export type ContractSchema<T> = JSONSchemaType<T>;

export interface SchemaViolation {
  /** JSON Pointer to the offending location, e.g. "/items/0/quantity". "" is the root. */
  readonly path: string;
  readonly message: string;
}

const MAX_REPORTED_VIOLATIONS = 20;

/**
 * Validates API payloads against JSON Schema contracts (Ajv, draft 2020-12 compatible subset).
 * Violations report locations and rules only, never the offending values, because payloads can
 * contain PHI or PII. Compiled validators are cached per schema object.
 */
export class SchemaValidator {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });
  private readonly compiled = new WeakMap<object, ValidateFunction>();

  public constructor() {
    addFormats(this.ajv, ['date-time', 'email', 'uuid', 'uri']);
  }

  /** Returns `data` typed as `T`, or throws a ValidationError listing every violation. */
  public validate<T>(schema: ContractSchema<T>, data: unknown, contractName: string): T {
    const violations = this.check(schema, data);
    if (violations.length > 0) {
      throw new ValidationError(
        `Response does not match the ${contractName} contract: ${violations
          .slice(0, 3)
          .map((violation) => `${violation.path || '(root)'} ${violation.message}`)
          .join('; ')}${violations.length > 3 ? '; …' : ''}`,
        { context: { contract: contractName, violations } },
      );
    }
    return data as T;
  }

  /** Returns the violations without throwing; an empty list means the data is valid. */
  public check<T>(schema: ContractSchema<T>, data: unknown): SchemaViolation[] {
    const validate = this.compile(schema);
    if (validate(data)) {
      return [];
    }
    return (validate.errors ?? []).slice(0, MAX_REPORTED_VIOLATIONS).map(describeViolation);
  }

  private compile(schema: object): ValidateFunction {
    let validate = this.compiled.get(schema);
    if (validate === undefined) {
      validate = this.ajv.compile(schema);
      this.compiled.set(schema, validate);
    }
    return validate;
  }
}

function describeViolation(error: ErrorObject): SchemaViolation {
  const property =
    error.keyword === 'additionalProperties' && 'additionalProperty' in error.params
      ? ` (${String(error.params.additionalProperty)})`
      : '';
  return { path: error.instancePath, message: `${error.message ?? error.keyword}${property}` };
}
