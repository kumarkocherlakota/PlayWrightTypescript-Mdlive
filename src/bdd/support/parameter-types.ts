import { defineParameterType } from '@cucumber/cucumber';
import { FrameworkError } from '@core/errors';
import { SENSITIVE_VALUE_TYPES } from '@core/test-data';
import { APPOINTMENT_STATUSES, LIMIT_SIDES, POLICY_LIMITS } from '@domains/appointments';
import { PORTAL_PAGES } from '@domains/authentication';
import { ACCESS_METHODS } from '@domains/inventory';
import { CREDENTIAL_PROBLEMS } from '@domains/shared-kernel';

export const DIALOG_CLOSE_METHODS = ['Close button', 'Escape key'] as const;
export type DialogCloseMethod = (typeof DIALOG_CLOSE_METHODS)[number];

export const ORDINALS = ['first', 'second'] as const;
export type Ordinal = (typeof ORDINALS)[number];

/** Reason-for-visit lengths, relative to the configured maximum (C-08). */
export const REASON_LENGTHS = [
  '1 character over the maximum length',
  'the maximum length',
  '1 character',
  'no characters',
] as const;
export type ReasonLength = (typeof REASON_LENGTHS)[number];

/** Requests a service client sends in role-based access scenarios. */
export const SERVICE_CLIENT_REQUESTS = ['directory', 'appointment list', 'booking'] as const;
export type ServiceClientRequest = (typeof SERVICE_CLIENT_REQUESTS)[number];

/** Defines a parameter type accepting exactly one of `values` (longest alternatives first). */
function defineEnumParameterType(name: string, values: readonly string[]): void {
  const alternatives = [...values].sort((left, right) => right.length - left.length);
  defineParameterType({
    name,
    regexp: new RegExp(alternatives.join('|')),
    transformer: (text: string): string => {
      const match = values.find((value) => value === text);
      if (match === undefined) {
        throw new FrameworkError(`Unsupported ${name} "${text}".`);
      }
      return match;
    },
  });
}

defineEnumParameterType('dialogCloseMethod', DIALOG_CLOSE_METHODS);
defineEnumParameterType('accessMethod', ACCESS_METHODS);
defineEnumParameterType('sensitiveValueType', SENSITIVE_VALUE_TYPES);
defineEnumParameterType('credentialProblem', CREDENTIAL_PROBLEMS);
defineEnumParameterType('ordinal', ORDINALS);
defineEnumParameterType('reasonLength', REASON_LENGTHS);
defineEnumParameterType('limitSide', LIMIT_SIDES);
defineEnumParameterType('policyLimit', POLICY_LIMITS);
defineEnumParameterType('appointmentStatus', APPOINTMENT_STATUSES);
defineEnumParameterType('portalPage', Object.keys(PORTAL_PAGES));
defineEnumParameterType('serviceClientRequest', SERVICE_CLIENT_REQUESTS);
