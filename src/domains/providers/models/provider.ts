/** Specialties offered by the synthetic provider directory of the reference app. */
export const SPECIALTIES = ['Cardiology', 'Dermatology', 'Family Medicine', 'Pediatrics'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly specialty: Specialty;
  readonly location: string;
}

/** A bookable time of a provider. `start` is an ISO 8601 instant (UTC). */
export interface Slot {
  readonly id: string;
  readonly providerId: string;
  readonly start: string;
  readonly durationMinutes: number;
}

export interface SlotAvailability extends Slot {
  readonly available: boolean;
}

export interface ProviderSearchCriteria {
  readonly name?: string;
  readonly specialty?: string;
  readonly limit?: number;
}

export interface ProviderSearchResult {
  readonly providers: readonly Provider[];
  /** Number of matching providers before `limit` was applied. */
  readonly total: number;
  readonly limit: number;
}

export interface NewSlot {
  readonly start: string;
  readonly durationMinutes: number;
}

/** A synthetic provider created through the test-support API. */
export interface NewProvider {
  readonly name: string;
  readonly specialty: Specialty;
  readonly location: string;
  readonly slots: readonly NewSlot[];
}

export interface SeededProvider {
  readonly provider: Provider;
  /** Created slots, in the order they were requested. */
  readonly slots: readonly Slot[];
}

/** What a member sees for one provider in the portal's search results. */
export interface ProviderCard {
  readonly name: string;
  readonly specialty: string;
  readonly location: string;
  /** ISO instants of the times offered for booking. */
  readonly availableTimes: readonly string[];
}

export interface PortalSearchResult {
  readonly announcement: string;
  readonly providerNames: readonly string[];
}
