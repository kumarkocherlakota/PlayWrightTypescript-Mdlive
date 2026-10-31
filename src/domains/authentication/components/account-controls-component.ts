import { BaseComponent, type UiContext } from '@interaction/ui';

/** The signed-in member's account controls in the portal page header. */
export class AccountControlsComponent extends BaseComponent {
  public constructor(ui: UiContext) {
    super(ui.page.getByRole('banner'), ui, 'portal account controls');
  }

  /** Signs out and resolves once the portal has sent the browser to the sign-in page. */
  public async signOut(signInPath: string): Promise<void> {
    await this.perform('sign out', async () => {
      await Promise.all([
        this.ui.page.waitForURL((url) => url.pathname === signInPath),
        this.root.getByRole('button', { name: 'Sign out' }).click(),
      ]);
    });
  }
}
