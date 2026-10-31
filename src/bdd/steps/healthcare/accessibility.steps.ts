import { Then, When, type DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { SignInWorkflow } from '@domains/authentication';
import { checkAccessibility } from '@bdd/support/accessibility-reporter';
import type { CustomWorld } from '@bdd/world/custom-world';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    /** Where keyboard focus landed, in order ("focus moved through"). */
    'accessibility.focusStops': readonly {
      readonly role: string;
      readonly name: string;
      readonly indicatorVisible: boolean;
    }[];
  }
}

When('a visitor opens the sign-in page', async function (this: CustomWorld) {
  await new SignInWorkflow(this.uiContext, this.secrets).openSignInPage();
});

When(
  'the visitor moves keyboard focus forward {int} times',
  async function (this: CustomWorld, count: number) {
    this.state.set('accessibility.focusStops', await this.keyboard.tabThrough(count));
  },
);

Then(
  'keyboard focus moved through these controls, each with a visible focus indicator:',
  function (this: CustomWorld, table: DataTable) {
    const expected = table.hashes().map((row) => ({
      role: row.role,
      name: row.name,
      indicatorVisible: true,
    }));
    expect(this.state.get('accessibility.focusStops')).toEqual(expected);
  },
);

Then(
  'automated accessibility checks of {string} find no violations at or above the configured impact',
  async function (this: CustomWorld, label: string) {
    await checkAccessibility(this, label);
  },
);
