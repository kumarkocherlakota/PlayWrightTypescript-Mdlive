import { expect, type Locator } from '@playwright/test';
import { BasePage, FormComponent, NotificationComponent, type UiContext } from '@interaction/ui';
import { ProviderCardComponent } from '../components/provider-card-component';

/** "Find a provider" page of the patient portal. */
export class ProviderSearchPage extends BasePage {
  public readonly name = 'Provider search page';
  protected readonly path = '/portal/providers';
  private readonly form: FormComponent;
  private readonly status: NotificationComponent;

  public constructor(ui: UiContext) {
    super(ui);
    this.form = new FormComponent(
      this.page.getByRole('form', { name: 'Provider search' }),
      ui,
      'provider search form',
    );
    this.status = new NotificationComponent(this.page.getByRole('status'), ui, 'search status');
  }

  public async waitUntilReady(): Promise<void> {
    await this.form.waitUntilVisible();
  }

  /**
   * Searches and waits for the announcement of the outcome (never for a fixed time).
   * Returns the announcement text.
   */
  public async search(criteria: { name?: string; specialty?: string }): Promise<string> {
    await this.form.fill('Provider name', criteria.name ?? '');
    await this.form.select('Specialty', criteria.specialty ?? 'Any specialty');
    await this.form.submit('Search');
    return this.status.waitForMessage(/^(No providers match your search\.|\d+ providers? found)$/);
  }

  public async resultNames(): Promise<string[]> {
    const names = await this.results().getByRole('heading', { level: 2 }).allInnerTexts();
    return names.map((name) => name.trim());
  }

  public async card(providerName: string): Promise<ProviderCardComponent> {
    const root = this.results().getByRole('article', { name: providerName, exact: true });
    await expect(root).toBeVisible({ timeout: this.ui.expectTimeoutMs });
    return new ProviderCardComponent(root, this.ui, providerName);
  }

  private results(): Locator {
    return this.page.getByRole('list', { name: 'Providers', exact: true });
  }
}
