import { expect, type Locator } from '@playwright/test';
import { BasePage, NavigationComponent, type UiContext } from '@interaction/ui';

export class AboutPage extends BasePage {
  public readonly name = 'about page';
  protected readonly path = '/gallery/about';

  public readonly navigation: NavigationComponent;
  private readonly heading: Locator;

  public constructor(ui: UiContext) {
    super(ui);
    this.heading = ui.page.getByRole('heading', { level: 1, name: 'About this gallery' });
    this.navigation = new NavigationComponent(
      ui.page.getByRole('navigation', { name: 'Main' }),
      ui,
      'main navigation',
    );
  }

  public async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: this.ui.expectTimeoutMs });
  }

  public async headingText(): Promise<string> {
    return (await this.heading.innerText()).trim();
  }
}
