import type { ApiResponse, HttpClient, SchemaValidator } from '@interaction/api';
import { rejectionFrom, type RequestOutcome } from '@domains/shared-kernel';
import type {
  Provider,
  ProviderSearchCriteria,
  ProviderSearchResult,
  SlotAvailability,
} from '../models/provider';
import {
  providerSchema,
  providerSearchSchema,
  providerSlotsSchema,
} from '../schemas/provider-schemas';

const PROVIDERS = '/providers';

/** Typed client for the provider-directory API; responses are checked against their contracts. */
export class ProviderDirectoryClient {
  public constructor(
    private readonly http: HttpClient,
    private readonly validator: SchemaValidator,
  ) {}

  public async search(criteria: ProviderSearchCriteria): Promise<ProviderSearchResult> {
    const response = await this.http.get(PROVIDERS, {
      query: { ...criteria },
      expectedStatus: 200,
    });
    return this.searchResult(response);
  }

  public async attemptSearch(
    criteria: ProviderSearchCriteria,
  ): Promise<RequestOutcome<ProviderSearchResult>> {
    const response = await this.http.get(PROVIDERS, { query: { ...criteria } });
    return response.status === 200
      ? { accepted: true, status: 200, value: this.searchResult(response) }
      : rejectionFrom(response, this.validator);
  }

  public async find(id: string): Promise<Provider | undefined> {
    const response = await this.http.get(providerPath(id), { expectedStatus: [200, 404] });
    return response.status === 404
      ? undefined
      : this.validator.validate(providerSchema, response.body, 'provider');
  }

  /** Upcoming times of the provider, earliest first, with their availability. */
  public async slots(providerId: string): Promise<readonly SlotAvailability[]> {
    const response = await this.http.get(`${providerPath(providerId)}/slots`, {
      expectedStatus: 200,
    });
    return this.validator.validate(providerSlotsSchema, response.body, 'provider slots').slots;
  }

  private searchResult(response: ApiResponse): ProviderSearchResult {
    return this.validator.validate(providerSearchSchema, response.body, 'provider search');
  }
}

function providerPath(id: string): string {
  return `${PROVIDERS}/${encodeURIComponent(id)}`;
}
