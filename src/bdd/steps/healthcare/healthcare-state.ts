import type { AppointmentPolicy } from '@core/config';
import { TestDataError } from '@core/errors';
import { requireAppointmentPolicy, type Appointment } from '@domains/appointments';
import type { SeededProvider, Slot } from '@domains/providers';
import type { RequestOutcome } from '@domains/shared-kernel';
import type { Ordinal, ReasonLength } from '@bdd/support/parameter-types';
import type { CustomWorld } from '@bdd/world/custom-world';

export type RequestKind = 'directory' | 'booking' | 'cancellation';

declare module '@bdd/world/scenario-state' {
  interface ScenarioState {
    /** The synthetic provider this scenario seeded ("that provider"). */
    'healthcare.provider': SeededProvider;
    /** The appointment the scenario is about ("that appointment"). */
    'healthcare.appointment': Appointment;
    /** Outcome of the last request that may legitimately be rejected. */
    'healthcare.outcome': { readonly kind: RequestKind; readonly outcome: RequestOutcome<unknown> };
  }
}

/** The provider's time by position: "the first time of that provider". */
export function slotOf(world: CustomWorld, ordinal: Ordinal): Slot {
  const { slots, provider } = world.state.get('healthcare.provider');
  const slot = slots[ordinal === 'first' ? 0 : 1];
  if (slot === undefined) {
    throw new TestDataError(
      `${provider.name} has no ${ordinal} time; seed more times in the scenario.`,
    );
  }
  return slot;
}

export function policyOf(world: CustomWorld): AppointmentPolicy {
  return requireAppointmentPolicy(world.config);
}

/** Converts a reason length relative to the configured maximum into characters. */
export function reasonLengthFor(world: CustomWorld, length: ReasonLength): number {
  const max = policyOf(world).reasonForVisitMaxLength;
  switch (length) {
    case 'no characters':
      return 0;
    case '1 character':
      return 1;
    case 'the maximum length':
      return max;
    case '1 character over the maximum length':
      return max + 1;
  }
}

export function recordOutcome(
  world: CustomWorld,
  kind: RequestKind,
  outcome: RequestOutcome<unknown>,
): void {
  world.state.set('healthcare.outcome', { kind, outcome });
}
