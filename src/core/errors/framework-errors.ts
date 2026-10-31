export type ErrorContext = Readonly<Record<string, unknown>>;

export interface FrameworkErrorOptions {
  readonly cause?: unknown;
  readonly context?: ErrorContext;
}

/**
 * Root of all framework errors. Carries a stable machine-readable `code` (used by failure
 * classification) and structured `context`. Context is redacted before it is logged or attached.
 */
export class FrameworkError extends Error {
  public readonly code: string;
  public readonly context: ErrorContext;

  public constructor(message: string, options: FrameworkErrorOptions = {}, code = 'FRAMEWORK') {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.context = Object.freeze({ ...options.context });
  }
}

export class ConfigurationError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'CONFIGURATION');
  }
}

export class NavigationError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'NAVIGATION');
  }
}

export class AuthenticationError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'AUTHENTICATION');
  }
}

export class ApiRequestError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'API_REQUEST');
  }
}

export class LocatorError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'LOCATOR');
  }
}

export class TestDataError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'TEST_DATA');
  }
}

export class ValidationError extends FrameworkError {
  public constructor(message: string, options?: FrameworkErrorOptions) {
    super(message, options, 'VALIDATION');
  }
}
