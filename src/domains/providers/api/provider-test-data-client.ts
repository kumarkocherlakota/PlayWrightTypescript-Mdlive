import type { HttpClient, SchemaValidator } from '@interaction/api';
import type { NewProvider, SeededProvider } from '../models/provider';
import { seededProviderSchema } from '../schemas/provider-schemas';

const SEEDED_PROVIDERS = '/test-support/providers';

/**
 * Client for the reference app's test-support API, which seeds synthetic providers and their
 * times. Removing a seeded provider also removes its times and any appointments on them.
 * Whether the application under test offers a seeding interface is open (CLARIFICATIONS C-19).
 */
export class ProviderTestDataClient {
  public constructor(
    private readonly http: HttpClient,
    private readonly validator: SchemaValidator,
  ) {}

  public async seed(provider: NewProvider): Promise<SeededProvider> {
    const response = await this.http.post(SEEDED_PROVIDERS, {
      json: provider,
      expectedStatus: 201,
    });
    return this.validator.validate(seededProviderSchema, response.body, 'seeded provider');
  }

  /** Removes the provider if it still exists; returns false when it was already gone. */
  public async removeIfPresent(id: string): Promise<boolean> {
    const response = await this.http.delete(`${SEEDED_PROVIDERS}/${encodeURIComponent(id)}`, {
      expectedStatus: [204, 404],
    });
    return response.status === 204;
  }
}
