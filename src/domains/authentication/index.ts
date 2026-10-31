/**
 * Public contract of the authentication domain: signing the synthetic member in to the patient
 * portal and checking how the portal protects its session (RULE-018).
 */
export {
  PROTECTED_PORTAL_PAGES,
  SignInWorkflow,
  type ProtectedPortalPage,
  type SessionCookieAttributes,
  type SignInAttempt,
} from './workflows/sign-in-workflow';
