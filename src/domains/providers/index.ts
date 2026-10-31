/**
 * Public contract of the providers domain: the synthetic provider directory over the API and in
 * the patient portal, plus seeding of scenario-owned providers (RULE-018).
 */
export {
  SPECIALTIES,
  type NewProvider,
  type PortalSearchResult,
  type Provider,
  type ProviderCard,
  type ProviderSearchCriteria,
  type ProviderSearchResult,
  type SeededProvider,
  type Slot,
  type SlotAvailability,
  type Specialty,
} from './models/provider';
export type { ProviderBuilder } from './builders/provider-builder';
export { ProviderDirectoryWorkflow } from './workflows/provider-directory-workflow';
export { ProviderSearchWorkflow } from './workflows/provider-search-workflow';
