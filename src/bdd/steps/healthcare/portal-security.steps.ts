import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { AppointmentServiceWorkflow } from '@domains/appointments';
import {
  SignInWorkflow,
  type PortalPage,
  type SecurityHeaderAssessment,
  type SignOutResult,
} from '@domains/authentication';
import { ProviderDirectoryWorkflow } from '@domains/providers';
import type { RequestOutcome } from '@domains/shared-kernel';
import type { ServiceClientRequest } from '@bdd/support/parameter-types';
import type { CustomWorld } from '@bdd/world/custom-world';
import { recordOutcome, slotOf } from './healthcare-state';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'authentication.signOut': SignOutResult;
    'authentication.securityHeaders': SecurityHeaderAssessment;
  }
}

When(
  'the member signs out and the session from before signing out is sent again',
  async function (this: CustomWorld) {
    const result = await new SignInWorkflow(this.uiContext, this.secrets).signOutAndReuseSession();
    this.state.set('authentication.signOut', result);
  },
);

Then('the browser no longer holds a portal session', function (this: CustomWorld) {
  expect(this.state.get('authentication.signOut').sessionCookieCleared).toBe(true);
});

Then('the portal does not accept the previous session', function (this: CustomWorld) {
  expect(this.state.get('authentication.signOut').previousSessionAccepted).toBe(false);
});

When('the {portalPage} page is requested', async function (this: CustomWorld, page: PortalPage) {
  const workflow = new SignInWorkflow(this.uiContext, this.secrets);
  this.state.set('authentication.securityHeaders', await workflow.securityHeadersOf(page));
});

Then(
  'the response forbids framing, inline scripts and content-type sniffing and limits referrer information',
  function (this: CustomWorld) {
    expect(this.state.get('authentication.securityHeaders')).toEqual({
      framingBlocked: true,
      inlineScriptBlocked: true,
      contentSniffingBlocked: true,
      referrerLimited: true,
    });
  },
);

const SERVICE_CLIENT_ATTEMPTS: Readonly<
  Record<ServiceClientRequest, (world: CustomWorld) => Promise<RequestOutcome<unknown>>>
> = {
  directory: (world) =>
    new ProviderDirectoryWorkflow(world.apiContext).attemptSearchAsServiceClient(),
  'appointment list': (world) =>
    new AppointmentServiceWorkflow(world.apiContext).attemptToListAsServiceClient(),
  booking: (world) =>
    new AppointmentServiceWorkflow(world.apiContext).attemptToBookAsServiceClient(
      slotOf(world, 'first').id,
    ),
};

When(
  'the service client sends a {serviceClientRequest} request',
  async function (this: CustomWorld, request: ServiceClientRequest) {
    recordOutcome(this, request, await SERVICE_CLIENT_ATTEMPTS[request](this));
  },
);
