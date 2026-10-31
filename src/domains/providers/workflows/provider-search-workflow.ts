import type { UiContext } from '@interaction/ui';
import type { PortalSearchResult, ProviderCard } from '../models/provider';
import { ProviderSearchPage } from '../pages/provider-search-page';

/** Searching the provider directory in the patient portal, as a signed-in member would. */
export class ProviderSearchWorkflow {
  private readonly page: ProviderSearchPage;

  public constructor(ui: UiContext) {
    this.page = new ProviderSearchPage(ui);
  }

  public async search(criteria: {
    name?: string;
    specialty?: string;
  }): Promise<PortalSearchResult> {
    await this.page.open();
    const announcement = await this.page.search(criteria);
    return { announcement, providerNames: await this.page.resultNames() };
  }

  /** Searches for one provider by name and returns what its result card shows. */
  public async findProvider(name: string): Promise<ProviderCard> {
    await this.search({ name });
    return (await this.page.card(name)).read();
  }

  /** Searches for the provider and follows the link of one of its times. */
  public async chooseTime(providerName: string, isoStart: string): Promise<void> {
    await this.search({ name: providerName });
    await (await this.page.card(providerName)).chooseTime(isoStart);
  }
}
