import { NavigationError } from '@core/errors';
import type { Secret } from '@core/security';
import { BasePage, FormComponent, NotificationComponent, type UiContext } from '@interaction/ui';

export type SignInResult = 'signed in' | 'rejected';

/** Patient-portal sign-in page. Credentials are revealed only to type them into the fields. */
export class SignInPage extends BasePage {
  public readonly name = 'Sign-in page';
  protected readonly path = '/portal/sign-in';
  private readonly form: FormComponent;
  private readonly alert: NotificationComponent;

  public constructor(ui: UiContext) {
    super(ui);
    this.form = new FormComponent(
      this.page.getByRole('form', { name: 'Sign in' }),
      ui,
      'sign-in form',
    );
    this.alert = new NotificationComponent(this.page.getByRole('alert'), ui, 'sign-in error');
  }

  public async waitUntilReady(): Promise<void> {
    await this.form.waitUntilVisible();
  }

  /** Submits the credentials and resolves once the portal has accepted or rejected them. */
  public async signIn(email: Secret, password: Secret): Promise<SignInResult> {
    await this.form.fill('Email', email.reveal());
    await this.form.fill('Password', password.reveal());
    await Promise.all([
      this.page
        .waitForURL((url) => url.pathname !== this.path || url.searchParams.has('error'))
        .catch((error: unknown) => {
          throw new NavigationError('The portal did not respond to the sign-in.', {
            cause: error,
            context: { page: this.name },
          });
        }),
      this.form.submit('Sign in'),
    ]);
    return new URL(this.page.url()).pathname === this.path ? 'rejected' : 'signed in';
  }

  public async errorMessage(): Promise<string> {
    await this.alert.waitUntilVisible();
    return this.alert.message();
  }

  /** True when the browser is currently on this page (e.g. after a redirect). */
  public isCurrent(): boolean {
    return new URL(this.page.url()).pathname === this.path;
  }
}
