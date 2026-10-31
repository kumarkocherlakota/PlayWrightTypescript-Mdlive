/** Result of a request that may legitimately be rejected (negative and boundary tests). */
export type RequestOutcome<T> =
  { readonly accepted: true; readonly status: number; readonly value: T } | RequestRejection;

export interface RequestRejection {
  readonly accepted: false;
  readonly status: number;
  /** Machine-readable error code from the service, e.g. "validation_failed". */
  readonly error: string;
  /** Fields the service reported as invalid; empty when the error is not field-specific. */
  readonly invalidFields: readonly string[];
}
