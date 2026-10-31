/**
 * Typed registry of everything a scenario may store between steps. Each step module adds its own
 * keys through declaration merging, so the World never needs to know about domains:
 *
 *   declare module '@bdd/world/scenario-state' {
 *     interface ScenarioState { 'appointments.booked': AppointmentReference }
 *   }
 *
 * Keys are namespaced by domain ("<domain>.<name>") to avoid collisions.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- extended via declaration merging
export interface ScenarioState {}
