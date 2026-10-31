import type { UiContext } from '@interaction/ui';
import {
  catalogItemFromRecord,
  type DialogState,
  type GalleryPageState,
  type SearchAttempt,
  type SearchCriteria,
  type SearchResults,
} from '../models/catalog-item';
import { AboutPage } from '../pages/about-page';
import { CatalogPage } from '../pages/catalog-page';

export type GallerySection = 'Catalog' | 'About';

/**
 * User-level processes in the component gallery. Coordinates pages and components; returns
 * plain state so steps assert on values, never on locators.
 */
export class ComponentGalleryWorkflow {
  private readonly catalog: CatalogPage;
  private readonly about: AboutPage;

  public constructor(private readonly ui: UiContext) {
    this.catalog = new CatalogPage(ui);
    this.about = new AboutPage(ui);
  }

  public async openCatalog(): Promise<void> {
    await this.catalog.open();
  }

  public async search(criteria: SearchCriteria): Promise<SearchResults> {
    this.ui.logger.info('Searching the catalog', { category: criteria.category ?? 'all' });
    await this.catalog.enterCriteria(criteria);
    const announcement = await this.catalog.submitAndWaitForResults();
    const rows = (await this.catalog.results.isVisible())
      ? await this.catalog.results.readRows()
      : [];
    return { items: rows.map(catalogItemFromRecord), announcement };
  }

  /** Submits a search whose acceptance is under test and reports how the application reacted. */
  public async attemptSearch(criteria: SearchCriteria): Promise<SearchAttempt> {
    await this.catalog.enterCriteria(criteria);
    const outcome = await this.catalog.submitAndWaitForOutcome();
    return outcome === 'accepted'
      ? { accepted: true, announcement: await this.catalog.searchStatus.message() }
      : {
          accepted: false,
          validationMessage: await this.catalog.searchForm.validationMessageFor('Keyword'),
        };
  }

  public async openItemDetails(itemName: string): Promise<DialogState> {
    await this.catalog.openItemDetails(itemName);
    return {
      title: await this.catalog.itemDetails.title(),
      hasFocus: await this.catalog.itemDetails.containsFocus(),
    };
  }

  public async closeItemDetails(using: 'button' | 'escape'): Promise<void> {
    await (using === 'button'
      ? this.catalog.itemDetails.close()
      : this.catalog.itemDetails.closeWithEscape());
  }

  public async isItemDetailsOpen(): Promise<boolean> {
    return this.catalog.itemDetails.isVisible();
  }

  public async navigateTo(section: GallerySection): Promise<GalleryPageState> {
    await this.catalog.navigation.goTo(section);
    if (section === 'About') {
      await this.about.waitUntilLoaded();
      return {
        heading: await this.about.headingText(),
        currentNavigationItem: await this.about.navigation.currentItem(),
      };
    }
    await this.catalog.waitUntilLoaded();
    return {
      heading: await this.catalog.headingText(),
      currentNavigationItem: await this.catalog.navigation.currentItem(),
    };
  }
}
