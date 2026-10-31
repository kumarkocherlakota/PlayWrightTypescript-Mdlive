import type { Locator } from '@playwright/test';
import { BaseComponent } from '../base-component';
import type { UiContext } from '../ui-context';

/** A landmark navigation region (`<nav aria-label="…">`) with links. */
export class NavigationComponent extends BaseComponent {
  public constructor(root: Locator, ui: UiContext, description = 'navigation') {
    super(root, ui, description);
  }

  public async goTo(linkName: string): Promise<void> {
    await this.perform(`follow "${linkName}"`, () =>
      this.root.getByRole('link', { name: linkName, exact: true }).click(),
    );
  }

  /** Name of the link marked `aria-current="page"`, or undefined when none is marked. */
  public async currentItem(): Promise<string | undefined> {
    // ARIA attribute selector: getByRole has no `current` filter (locator priority 6, ADR-005).
    const current = this.root.locator('[aria-current="page"]');
    return (await current.count()) === 0 ? undefined : (await current.innerText()).trim();
  }
}
