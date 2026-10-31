import { randomBytes } from 'node:crypto';
import { NoAuth, StaticBearerAuth, type AuthStrategy } from '@interaction/api';

/** Kinds of missing or invalid credentials used by negative security scenarios. */
export const CREDENTIAL_PROBLEMS = ['no credentials', 'an invalid token'] as const;
export type CredentialProblem = (typeof CREDENTIAL_PROBLEMS)[number];

/** An auth strategy exhibiting the problem; the invalid token is random and JWT-shaped. */
export function strategyWith(problem: CredentialProblem): AuthStrategy {
  switch (problem) {
    case 'no credentials':
      return new NoAuth();
    case 'an invalid token':
      return new StaticBearerAuth(`synthetic.${randomBytes(16).toString('base64url')}.invalid`);
  }
}
