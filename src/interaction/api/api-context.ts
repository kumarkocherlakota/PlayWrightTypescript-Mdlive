import type { ExecutionLogger } from '@core/logging';
import type { CleanupRegistry, UniqueIdGenerator } from '@core/test-data';
import type { ApiSession } from './api-session';

/** Everything a domain API client or workflow needs; built once per scenario by the World. */
export interface ApiContext {
  readonly session: ApiSession;
  readonly logger: ExecutionLogger;
  /** Worker-scoped generator for unique synthetic identifiers (ADR-006). */
  readonly ids: UniqueIdGenerator;
  /** Scenario-scoped registry; register an undo action for everything you create. */
  readonly cleanup: CleanupRegistry;
}
