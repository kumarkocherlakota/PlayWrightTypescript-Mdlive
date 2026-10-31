import { TestDataError } from '@core/errors';
import type { UniqueIdGenerator } from '@core/test-data';
import type { BookingRequest } from '../models/appointment';

/**
 * Builds synthetic booking requests. The default reason for visit is obviously synthetic and
 * carries the marker; it never describes a real condition.
 */
export class BookingRequestBuilder {
  private request: BookingRequest;

  public constructor(
    private readonly ids: UniqueIdGenerator,
    slotId: string,
  ) {
    this.request = { slotId, reasonForVisit: `${ids.marker}synthetic routine check-up` };
  }

  public withReason(reasonForVisit: string): this {
    this.request = { ...this.request, reasonForVisit };
    return this;
  }

  /** A reason of exactly `length` characters, starting with the marker when there is room. */
  public withReasonOfLength(length: number): this {
    if (!Number.isInteger(length) || length < 0) {
      throw new TestDataError(`Reason length must be a non-negative integer, got ${length}.`);
    }
    const marker = this.ids.marker;
    return this.withReason(
      length > marker.length ? marker.padEnd(length, 'r') : 'r'.repeat(length),
    );
  }

  public build(): BookingRequest {
    return { ...this.request };
  }

  /** A payload that may break the contract on purpose (missing or unknown fields). */
  public buildPayloadWith(changes: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return { ...this.request, ...changes };
  }
}
