/**
 * Public contract of the authentication domain: signing the synthetic member in to the patient
 * portal and checking how the portal protects its session (RULE-018).
 */
export type { SecurityHeaderAssessment } from '@core/security';
export {
  PORTAL_PAGES,
  PROTECTED_PORTAL_PAGES,
  SignInWorkflow,
  type PortalPage,
  type ProtectedPortalPage,
  type SessionCookieAttributes,
  type SignInAttempt,
  type SignOutResult,
} from './workflows/sign-in-workflow';
