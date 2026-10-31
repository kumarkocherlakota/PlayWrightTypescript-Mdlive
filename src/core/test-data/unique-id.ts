import { createHash } from 'node:crypto';
import { TestDataError } from '@core/errors';

export interface UniqueIdOptions {
  /** Synthetic-data marker that starts every identifier (`healthcare.syntheticDataMarker`). */
  readonly marker: string;
  readonly runId: string;
  readonly workerId: string;
}

const LABEL = /^[A-Z][A-Z0-9]{0,15}$/;

/**
 * Generates identifiers that are unique across parallel workers and retries (ADR-006):
 * `<marker><LABEL>-<run hash>-<worker>-<sequence>`, e.g. `TEST-ITEM-3f9a1c-w2-17`.
 * The run part is a short hash, so identifiers stay short even for long CI run IDs, and the
 * marker makes every record recognizable as synthetic.
 * Create one generator per worker process; sequences are not shared across processes.
 */
export class UniqueIdGenerator {
  /** The synthetic-data marker, for builders and validators that need to check it. */
  public readonly marker: string;
  private readonly prefix: string;
  private sequence = 0;

  public constructor(options: UniqueIdOptions) {
    const run = createHash('sha256').update(options.runId).digest('hex').slice(0, 6);
    const worker = options.workerId.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'main';
    this.marker = options.marker;
    this.prefix = `${run}-w${worker}`;
  }

  /** Returns the next identifier, e.g. `next('ITEM')` → `TEST-ITEM-3f9a1c-w2-17`. */
  public next(label: string): string {
    if (!LABEL.test(label)) {
      throw new TestDataError(
        `Identifier label "${label}" must be 1-16 upper-case letters or digits, starting with a letter.`,
        { context: { label } },
      );
    }
    this.sequence += 1;
    return `${this.marker}${label}-${this.prefix}-${this.sequence}`;
  }
}
