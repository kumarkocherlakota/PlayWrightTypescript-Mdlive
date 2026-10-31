import { HttpProblem } from './routing';

/** One field-level validation failure in the `validation_failed` error body. */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export function validationProblem(errors: readonly FieldError[]): HttpProblem {
  return new HttpProblem(400, { error: 'validation_failed', details: errors });
}

/** Throws a 400 `validation_failed` problem when `errors` is not empty. */
export function rejectInvalid(errors: readonly FieldError[]): void {
  if (errors.length > 0) {
    throw validationProblem(errors);
  }
}

export function unknownFields(
  body: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): FieldError[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map((field) => ({ field, message: 'is not a recognized field' }));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns the trimmed text when its length is within bounds, otherwise undefined. */
export function boundedText(value: unknown, min: number, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : undefined;
}
