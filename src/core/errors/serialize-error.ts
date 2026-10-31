import { FrameworkError } from './framework-errors';

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly stack?: string;
  readonly cause?: SerializedError;
}

const MAX_CAUSE_DEPTH = 5;

/**
 * Converts any thrown value into a plain, JSON-safe structure for logs and reports.
 * The result is not redacted; callers pass it through the Redactor before output.
 */
export function serializeError(error: unknown, depth = 0): SerializedError {
  if (!(error instanceof Error)) {
    return { name: 'NonErrorThrown', message: String(error) };
  }

  const cause =
    error.cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? serializeError(error.cause, depth + 1)
      : undefined;

  return {
    name: error.name,
    message: error.message,
    ...(error instanceof FrameworkError ? { code: error.code, context: error.context } : {}),
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(cause === undefined ? {} : { cause }),
  };
}
