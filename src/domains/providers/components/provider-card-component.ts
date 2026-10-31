import type { Locator } from '@playwright/test';
import { BaseComponent, type UiContext } from '@interaction/ui';
import type { ProviderCard } from '../models/provider';

/**
 * One provider in the search results (`<article>` labelled by the provider's name). Offered times
 * are links whose `<time datetime>` carries the ISO instant, so tests never parse localized text.
 */
export class ProviderCardComponent extends BaseComponent {
  public constructor(root: Locator, ui: UiContext, providerName: string) {
    super(root, ui, `provider card "${providerName}"`);
  }

  public async read(): Promise<ProviderCard> {
    return this.perform('read its details', async () => {
      const paragraphs = await this.root.getByRole('paragraph').allInnerTexts();
      return {
        name: (await this.root.getByRole('heading', { level: 2 }).innerText()).trim(),
        specialty: paragraphs[0]?.trim() ?? '',
        location: paragraphs[1]?.trim() ?? '',
        availableTimes: await this.availableTimes(),
      };
    });
  }

  /** Follows the link of the time starting at `isoStart`. */
  public async chooseTime(isoStart: string): Promise<void> {
    await this.perform(`choose the time ${isoStart}`, () =>
      this.times()
        .filter({ has: this.timeAt(isoStart) })
        .click(),
    );
  }

  private async availableTimes(): Promise<string[]> {
    const values = await this.times()
      .locator('time')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('datetime') ?? ''));
    return values.map((value) => new Date(value).toISOString());
  }

  private times(): Locator {
    return this.root.getByRole('list').getByRole('link');
  }

  /** `<time>` has no ARIA role, so its machine-readable value is matched by attribute. */
  private timeAt(isoStart: string): Locator {
    return this.ui.page.locator(`time[datetime="${new Date(isoStart).toISOString()}"]`);
  }
}
