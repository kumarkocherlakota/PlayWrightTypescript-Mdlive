import { AuthenticationError, NavigationError } from '@core/errors';
import {
  assessSecurityHeaders,
  Secret,
  type SecretProvider,
  type SecurityHeaderAssessment,
} from '@core/security';
import { syntheticSensitiveValue } from '@core/test-data';
import type { UiContext } from '@interaction/ui';
import { AccountControlsComponent } from '../components/account-controls-component';
import { SignInPage } from '../pages/sign-in-page';

/** Portal pages that require a signed-in member, by business name. */
export const PROTECTED_PORTAL_PAGES = {
  'my appointments': '/portal/dashboard',
  'find a provider': '/portal/providers',
  'book an appointment': '/portal/book',
} as const;
export type ProtectedPortalPage = keyof typeof PROTECTED_PORTAL_PAGES;

/** Every portal page by business name; protected pages need a signed-in member. */
export const PORTAL_PAGES = { 'sign-in': '/portal/sign-in', ...PROTECTED_PORTAL_PAGES } as const;
export type PortalPage = keyof typeof PORTAL_PAGES;

/** Name of the portal's session cookie (an implementation detail of the application). */
const SESSION_COOKIE = 'portal_session';

export interface SignInAttempt {
  readonly signedIn: boolean;
  readonly message: string | undefined;
}

/** Security attributes of the session cookie. The cookie value is never read into the result. */
export interface SessionCookieAttributes {
  readonly httpOnly: boolean;
  readonly sameSite: 'Strict' | 'Lax' | 'None';
}

/** What happened to the session when the member signed out. */
export interface SignOutResult {
  /** The browser no longer holds a session cookie after signing out. */
  readonly sessionCookieCleared: boolean;
  /** The portal still accepted the pre-sign-out session cookie when it was sent again. */
  readonly previousSessionAccepted: boolean;
}

/** Signs the synthetic member in and out of the patient portal. */
export class SignInWorkflow {
  public constructor(
    private readonly ui: UiContext,
    private readonly secrets: SecretProvider,
  ) {}

  /** Signs in with the configured member account (TEST_USER_EMAIL / TEST_USER_PASSWORD). */
  public async signInAsMember(): Promise<void> {
    const page = new SignInPage(this.ui);
    await page.open();
    const result = await page.signIn(
      this.secrets.require('TEST_USER_EMAIL'),
      this.secrets.require('TEST_USER_PASSWORD'),
    );
    if (result === 'rejected') {
      throw new AuthenticationError(
        'The portal rejected the configured member credentials. Check TEST_USER_EMAIL and TEST_USER_PASSWORD.',
        { context: { page: page.name } },
      );
    }
  }

  /** Tries the member's e-mail with a freshly generated wrong password. */
  public async attemptSignInWithWrongPassword(): Promise<SignInAttempt> {
    const page = new SignInPage(this.ui);
    await page.open();
    const result = await page.signIn(
      this.secrets.require('TEST_USER_EMAIL'),
      new Secret('synthetic wrong password', syntheticSensitiveValue('password')),
    );
    return result === 'signed in'
      ? { signedIn: true, message: undefined }
      : { signedIn: false, message: await page.errorMessage() };
  }

  /** Opens a protected page without signing in; true when the portal sent the browser to sign in. */
  public async isSentToSignInWhenVisiting(target: ProtectedPortalPage): Promise<boolean> {
    const path = PROTECTED_PORTAL_PAGES[target];
    await this.ui.page.goto(path).catch((error: unknown) => {
      throw new NavigationError(`Could not open ${target} at ${path}.`, {
        cause: error,
        context: { path },
      });
    });
    const page = new SignInPage(this.ui);
    if (!page.isCurrent()) {
      return false;
    }
    await page.waitUntilReady();
    return true;
  }

  /** Opens the sign-in page as a visitor, e.g. to check it before signing in. */
  public async openSignInPage(): Promise<void> {
    await new SignInPage(this.ui).open();
  }

  /**
   * Signs out, then sends the session cookie from before signing out again, as an attacker
   * holding a copied cookie would. The cookie stays inside the browser context; its value is
   * never read into the result, logged or attached.
   */
  public async signOutAndReuseSession(): Promise<SignOutResult> {
    const context = this.ui.page.context();
    const previousSession = (await context.cookies()).filter(
      (cookie) => cookie.name === SESSION_COOKIE,
    );
    if (previousSession.length === 0) {
      throw new AuthenticationError('There is no portal session to sign out of.');
    }
    await new AccountControlsComponent(this.ui).signOut(PORTAL_PAGES['sign-in']);
    const sessionCookieCleared = !(await context.cookies()).some(
      (cookie) => cookie.name === SESSION_COOKIE && cookie.value !== '',
    );
    await context.addCookies(previousSession);
    try {
      const sentToSignIn = await this.isSentToSignInWhenVisiting('my appointments');
      return { sessionCookieCleared, previousSessionAccepted: !sentToSignIn };
    } finally {
      await context.clearCookies({ name: SESSION_COOKIE });
    }
  }

  /** Opens the page and assesses the protections its response headers declare. */
  public async securityHeadersOf(target: PortalPage): Promise<SecurityHeaderAssessment> {
    const path = PORTAL_PAGES[target];
    const response = await this.ui.page.goto(path).catch((error: unknown) => {
      throw new NavigationError(`Could not open ${target} at ${path}.`, {
        cause: error,
        context: { path },
      });
    });
    if (response === null || new URL(this.ui.page.url()).pathname !== path) {
      throw new AuthenticationError(
        `The ${target} page was not served; sign in before checking a protected page.`,
        { context: { path } },
      );
    }
    return assessSecurityHeaders(response.headers());
  }

  public async sessionCookieAttributes(): Promise<SessionCookieAttributes | undefined> {
    const cookies = await this.ui.page.context().cookies();
    const session = cookies.find((cookie) => cookie.name === SESSION_COOKIE);
    return session === undefined
      ? undefined
      : { httpOnly: session.httpOnly, sameSite: session.sameSite };
  }

  /** True when page scripts can read the session cookie (they must not: HttpOnly). */
  public async isSessionCookieReadableByScripts(): Promise<boolean> {
    return this.ui.page.evaluate(
      (name) => document.cookie.split(';').some((pair) => pair.trim().startsWith(`${name}=`)),
      SESSION_COOKIE,
    );
  }
}
