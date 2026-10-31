import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { FrameworkError } from '@core/errors';
import { offsetFromLimit, type LimitSide, type PolicyLimit } from '@domains/appointments';
import {
  ProviderDirectoryWorkflow,
  ProviderSearchWorkflow,
  SPECIALTIES,
  type PortalSearchResult,
  type ProviderBuilder,
  type ProviderCard,
  type ProviderSearchResult,
  type Specialty,
} from '@domains/providers';
import type { CredentialProblem } from '@domains/shared-kernel';
import type { CustomWorld } from '@bdd/world/custom-world';
import { policyOf, recordOutcome } from './healthcare-state';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    'providers.portalSearch': PortalSearchResult;
    'providers.card': ProviderCard;
  }
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const MINUTE_MS = 60_000;

const directory = (world: CustomWorld): ProviderDirectoryWorkflow =>
  new ProviderDirectoryWorkflow(world.apiContext);
const portalSearch = (world: CustomWorld): ProviderSearchWorkflow =>
  new ProviderSearchWorkflow(world.uiContext);

function specialtyFrom(text: string): Specialty {
  const specialty = SPECIALTIES.find((each) => each === text);
  if (specialty === undefined) {
    throw new FrameworkError(`"${text}" is not a specialty of the synthetic directory.`, {
      context: { specialties: [...SPECIALTIES] },
    });
  }
  return specialty;
}

async function seed(world: CustomWorld, specialty: string, times: (b: ProviderBuilder) => void) {
  const builder = directory(world).newProvider().withSpecialty(specialtyFrom(specialty));
  times(builder);
  world.state.set('healthcare.provider', await directory(world).seed(builder.build()));
}

Given(
  'a synthetic {string} provider offers {int} time(s)',
  async function (this: CustomWorld, specialty: string, count: number) {
    await seed(this, specialty, (builder) => {
      for (let day = 1; day <= count; day += 1) {
        builder.withTimeStartingIn((day + 2) * DAY_MS);
      }
    });
  },
);

Given(
  'a synthetic {string} provider offers a time {int} minutes {limitSide} the {policyLimit}',
  async function (
    this: CustomWorld,
    specialty: string,
    margin: number,
    side: LimitSide,
    limit: PolicyLimit,
  ) {
    const offset = offsetFromLimit(policyOf(this), limit, side, margin);
    await seed(this, specialty, (builder) => builder.withTimeStartingIn(offset));
  },
);

Given(
  'a synthetic {string} provider offers a time that started {int} minutes ago',
  async function (this: CustomWorld, specialty: string, minutes: number) {
    await seed(this, specialty, (builder) => builder.withTimeStartingIn(-minutes * MINUTE_MS));
  },
);

When(
  'the member searches the portal for that provider by name',
  async function (this: CustomWorld) {
    const { name } = this.state.get('healthcare.provider').provider;
    this.state.set('providers.card', await portalSearch(this).findProvider(name));
  },
);

Then(
  "the result shows the provider's specialty, location and both times",
  function (this: CustomWorld) {
    const { provider, slots } = this.state.get('healthcare.provider');
    expect(this.state.get('providers.card')).toEqual({
      name: provider.name,
      specialty: provider.specialty,
      location: provider.location,
      availableTimes: slots.map((slot) => slot.start),
    });
  },
);

Then('the result offers only the second time', function (this: CustomWorld) {
  const { slots } = this.state.get('healthcare.provider');
  expect(this.state.get('providers.card').availableTimes).toEqual([slots[1]?.start]);
});

When(
  'the member searches the portal for a provider name that does not exist',
  async function (this: CustomWorld) {
    const name = this.apiContext.ids.next('NOMATCH');
    this.state.set('providers.portalSearch', await portalSearch(this).search({ name }));
  },
);

Then('the provider search announces {string}', function (this: CustomWorld, message: string) {
  const result = this.state.get('providers.portalSearch');
  expect(result.announcement).toBe(message);
  expect(result.providerNames).toEqual([]);
});

When(
  'the directory is searched for {string} providers',
  async function (this: CustomWorld, specialty: string) {
    recordOutcome(this, 'directory', await directory(this).attemptSearch({ specialty, limit: 50 }));
  },
);

When(
  'the directory is searched with {credentialProblem}',
  async function (this: CustomWorld, problem: CredentialProblem) {
    recordOutcome(this, 'directory', await directory(this).attemptSearchWith(problem));
  },
);

function acceptedSearch(world: CustomWorld): ProviderSearchResult {
  const { outcome } = world.state.get('healthcare.outcome');
  if (!outcome.accepted) {
    throw new FrameworkError(`The directory search was refused with ${outcome.error}.`);
  }
  return outcome.value as ProviderSearchResult;
}

Then(
  'every provider returned is a {string} provider',
  function (this: CustomWorld, specialty: string) {
    const specialties = new Set(acceptedSearch(this).providers.map((each) => each.specialty));
    expect([...specialties]).toEqual([specialty]);
  },
);

Then('the synthetic provider is among them', async function (this: CustomWorld) {
  // Narrowed by name as well, so the check does not depend on how many providers share the
  // specialty while other scenarios run.
  const { provider } = this.state.get('healthcare.provider');
  const { providers } = await directory(this).search({
    name: provider.name,
    specialty: provider.specialty,
  });
  expect(providers.map((each) => each.id)).toEqual([provider.id]);
});

Then(
  'the directory reports the first time as unavailable and the second as available',
  async function (this: CustomWorld) {
    const { provider, slots } = this.state.get('healthcare.provider');
    const reported = await directory(this).slots(provider.id);
    expect(reported.map(({ id, available }) => ({ id, available }))).toEqual([
      { id: slots[0]?.id, available: false },
      { id: slots[1]?.id, available: true },
    ]);
  },
);
