import { TestDataError } from '@core/errors';
import type { UniqueIdGenerator } from '@core/test-data';
import type { NewProvider, NewSlot, Specialty } from '../models/provider';

const DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_DURATION_MINUTES = 30;

/**
 * Builds a synthetic provider that is unique per scenario (ADR-006): its name starts with the
 * synthetic-data marker and contains a run- and worker-unique ID, so searches by that name see
 * only this scenario's provider even while other scenarios run in parallel.
 * By default it offers one time three days from now.
 */
export class ProviderBuilder {
  private provider: Omit<NewProvider, 'slots'>;
  private slots: NewSlot[] = [];

  public constructor(
    ids: UniqueIdGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {
    const id = ids.next('PROV');
    this.provider = {
      name: `${id} Synthetic Provider`,
      specialty: 'Family Medicine',
      location: `${ids.marker}Synthetic Clinic`,
    };
  }

  public withSpecialty(specialty: Specialty): this {
    this.provider = { ...this.provider, specialty };
    return this;
  }

  /** Adds a time starting `offsetMs` from now; negative offsets create times in the past. */
  public withTimeStartingIn(offsetMs: number, durationMinutes = DEFAULT_DURATION_MINUTES): this {
    if (!Number.isFinite(offsetMs)) {
      throw new TestDataError(
        `Time offset must be a finite number of milliseconds, got ${offsetMs}.`,
      );
    }
    this.slots.push({
      start: new Date(this.now().getTime() + offsetMs).toISOString(),
      durationMinutes,
    });
    return this;
  }

  public build(): NewProvider {
    const slots = this.slots.length > 0 ? this.slots : [this.defaultSlot()];
    return { ...this.provider, slots: [...slots] };
  }

  private defaultSlot(): NewSlot {
    return {
      start: new Date(this.now().getTime() + 3 * DAY_MS).toISOString(),
      durationMinutes: DEFAULT_DURATION_MINUTES,
    };
  }
}
