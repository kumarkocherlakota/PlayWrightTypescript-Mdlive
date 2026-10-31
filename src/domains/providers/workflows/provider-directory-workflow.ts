import { ValidationError } from '@core/errors';
import type { ApiContext } from '@interaction/api';
import { strategyWith, type CredentialProblem, type RequestOutcome } from '@domains/shared-kernel';
import { ProviderDirectoryClient } from '../api/provider-directory-client';
import { ProviderTestDataClient } from '../api/provider-test-data-client';
import { ProviderBuilder } from '../builders/provider-builder';
import type {
  NewProvider,
  Provider,
  ProviderSearchCriteria,
  ProviderSearchResult,
  SeededProvider,
  SlotAvailability,
} from '../models/provider';

/**
 * Provider-directory processes over the API: seeding synthetic providers (registered for cleanup
 * immediately, so nothing is left behind when a scenario fails) and searching the directory.
 */
export class ProviderDirectoryWorkflow {
  public constructor(private readonly api: ApiContext) {}

  /** A builder for a unique synthetic provider; adjust only what the scenario is about. */
  public newProvider(): ProviderBuilder {
    return new ProviderBuilder(this.api.ids);
  }

  /** Seeds the provider and checks the service created exactly the requested times. */
  public async seed(provider: NewProvider): Promise<SeededProvider> {
    const testData = new ProviderTestDataClient(
      this.api.session.client(),
      this.api.session.validator,
    );
    const seeded = await testData.seed(provider);
    this.api.cleanup.register(`remove synthetic provider ${seeded.provider.name}`, async () => {
      await testData.removeIfPresent(seeded.provider.id);
    });
    const requested = provider.slots.map((slot) => new Date(slot.start).toISOString());
    const created = seeded.slots.map((slot) => slot.start);
    if (seeded.provider.name !== provider.name || requested.join() !== created.join()) {
      throw new ValidationError(
        `Synthetic provider ${provider.name} was not seeded as requested.`,
        {
          context: { requestedSlots: requested.length, createdSlots: created.length },
        },
      );
    }
    return seeded;
  }

  public search(criteria: ProviderSearchCriteria): Promise<ProviderSearchResult> {
    return this.directory().search(criteria);
  }

  public attemptSearch(
    criteria: ProviderSearchCriteria,
  ): Promise<RequestOutcome<ProviderSearchResult>> {
    return this.directory().attemptSearch(criteria);
  }

  /** Searches with missing or invalid credentials; returns how the directory answered. */
  public attemptSearchWith(
    problem: CredentialProblem,
  ): Promise<RequestOutcome<ProviderSearchResult>> {
    const http = this.api.session.clientWith(strategyWith(problem));
    return new ProviderDirectoryClient(http, this.api.session.validator).attemptSearch({
      limit: 1,
    });
  }

  public find(id: string): Promise<Provider | undefined> {
    return this.directory().find(id);
  }

  public slots(providerId: string): Promise<readonly SlotAvailability[]> {
    return this.directory().slots(providerId);
  }

  private directory(): ProviderDirectoryClient {
    return new ProviderDirectoryClient(this.api.session.client(), this.api.session.validator);
  }
}
