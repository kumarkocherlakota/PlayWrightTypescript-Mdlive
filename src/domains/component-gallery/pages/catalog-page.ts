import { expect, type Locator } from '@playwright/test';
import {
  BasePage,
  DialogComponent,
  FormComponent,
  NavigationComponent,
  NotificationComponent,
  TableComponent,
  uiActionFailed,
  type UiContext,
} from '@interaction/ui';
import type { SearchCriteria } from '../models/catalog-item';

const SEARCH_API_PATH = '/gallery/api/catalog';
const RESULT_ANNOUNCEMENT = /^(No results found|\d+ results? found)$/;

/** The catalog search page of the synthetic component gallery. */
export class CatalogPage extends BasePage {
  public readonly name = 'catalog search page';
  protected readonly path = '/gallery';

  public readonly navigation: NavigationComponent;
  public readonly searchForm: FormComponent;
  public readonly results: TableComponent;
  public readonly searchStatus: NotificationComponent;
  public readonly itemDetails: DialogComponent;
  private readonly heading: Locator;

  public constructor(ui: UiContext) {
    super(ui);
    const { page } = ui;
    this.heading = page.getByRole('heading', { level: 1, name: 'Catalog search' });
    this.navigation = new NavigationComponent(
      page.getByRole('navigation', { name: 'Main' }),
      ui,
      'main navigation',
    );
    this.searchForm = new FormComponent(
      page.getByRole('form', { name: 'Catalog search' }),
      ui,
      'catalog search form',
    );
    this.results = new TableComponent(
      page.getByRole('table', { name: 'Search results' }),
      ui,
      'search results table',
    );
    this.searchStatus = new NotificationComponent(page.getByRole('status'), ui, 'search status');
    this.itemDetails = new DialogComponent(page.getByRole('dialog'), ui, 'item details dialog');
  }

  public async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: this.ui.expectTimeoutMs });
  }

  public async headingText(): Promise<string> {
    return (await this.heading.innerText()).trim();
  }

  public async enterCriteria(criteria: SearchCriteria): Promise<void> {
    await this.searchForm.fill('Keyword', criteria.keyword);
    await this.searchForm.select('Category', criteria.category ?? 'All categories');
  }

  /** Submits valid criteria and waits for the backend response and the result announcement. */
  public async submitAndWaitForResults(): Promise<string> {
    const response = await this.searchForm.submitAndWaitForResponse(
      'Search',
      (candidate) => new URL(candidate.url()).pathname === SEARCH_API_PATH,
    );
    if (!response.ok()) {
      throw uiActionFailed(this.name, 'load search results', `HTTP ${response.status()}`);
    }
    return this.searchStatus.waitForMessage(RESULT_ANNOUNCEMENT);
  }

  /**
   * Submits criteria whose validity is under test. Waits for whichever application state appears
   * first — the field marked invalid or a result announcement — instead of guessing with a delay.
   */
  public async submitAndWaitForOutcome(): Promise<'accepted' | 'rejected'> {
    const invalidKeyword = this.page
      .getByLabel('Keyword', { exact: true })
      .and(this.page.locator('[aria-invalid="true"]'));
    const announcement = this.page.getByRole('status').filter({ hasText: RESULT_ANNOUNCEMENT });

    await this.searchForm.submit('Search');
    await invalidKeyword
      .or(announcement)
      .waitFor({ state: 'visible', timeout: this.ui.expectTimeoutMs })
      .catch((error: unknown) => {
        throw uiActionFailed(this.name, 'show a search outcome', error);
      });
    return (await this.searchForm.isInvalid('Keyword')) ? 'rejected' : 'accepted';
  }

  public async openItemDetails(itemName: string): Promise<void> {
    await this.results.clickInRow(itemName, `View details for ${itemName}`);
    await this.itemDetails.waitUntilVisible();
  }
}
