/**
 * Public contract of the shared kernel: small value types and API conventions shared by the
 * healthcare domains (RULE-018). It holds no business process and depends on no other domain.
 */
export { rejectionFrom } from './api/api-rejection';
export {
  CREDENTIAL_PROBLEMS,
  strategyWith,
  type CredentialProblem,
} from './api/credential-problems';
export { serviceClientOf } from './api/service-client';
export type { RequestOutcome, RequestRejection } from './models/request-outcome';
