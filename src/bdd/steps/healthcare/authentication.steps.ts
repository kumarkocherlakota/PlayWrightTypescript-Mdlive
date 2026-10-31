import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { FrameworkError } from '@core/errors';
import { AppointmentDashboardWorkflow } from '@domains/appointments';
import {
  PROTECTED_PORTAL_PAGES,
  SignInWorkflow,
  type ProtectedPortalPage,
  type SignInAttempt,
} from '@domains/authentication';
import type { CustomWorld } from '@bdd/world/custom-world';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'authentication.attempt': SignInAttempt;
    'authentication.sentToSignIn': boolean;
  }
}

const signIn = (world: CustomWorld): SignInWorkflow =>
  new SignInWorkflow(world.uiContext, world.secrets);

When(
  /^the member (?:signs|is signed) in to the patient portal$/,
  async function (this: CustomWorld) {
    await signIn(this).signInAsMember();
  },
);

Then("the member's appointment dashboard is shown", async function (this: CustomWorld) {
  await new AppointmentDashboardWorkflow(this.uiContext).waitUntilShown();
});

When('the member tries to sign in with a wrong password', async function (this: CustomWorld) {
  this.state.set('authentication.attempt', await signIn(this).attemptSignInWithWrongPassword());
});

Then('the member is not signed in', function (this: CustomWorld) {
  expect(this.state.get('authentication.attempt').signedIn).toBe(false);
});

Then('the sign-in page says {string}', function (this: CustomWorld, message: string) {
  expect(this.state.get('authentication.attempt').message).toBe(message);
});

When(
  'a visitor who is not signed in opens the {string} page',
  async function (this: CustomWorld, page: string) {
    if (!(page in PROTECTED_PORTAL_PAGES)) {
      throw new FrameworkError(`Unknown portal page "${page}".`, {
        context: { known: Object.keys(PROTECTED_PORTAL_PAGES) },
      });
    }
    const sent = await signIn(this).isSentToSignInWhenVisiting(page as ProtectedPortalPage);
    this.state.set('authentication.sentToSignIn', sent);
  },
);

Then('the visitor is sent to the sign-in page', function (this: CustomWorld) {
  expect(this.state.get('authentication.sentToSignIn')).toBe(true);
});

Then(
  'the session cookie is HttpOnly with SameSite {string}',
  async function (this: CustomWorld, sameSite: string) {
    expect(await signIn(this).sessionCookieAttributes()).toEqual({ httpOnly: true, sameSite });
  },
);

Then('page scripts cannot read the session cookie', async function (this: CustomWorld) {
  expect(await signIn(this).isSessionCookieReadableByScripts()).toBe(false);
});
