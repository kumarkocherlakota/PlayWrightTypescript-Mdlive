import type { SensitiveValueType } from '@core/test-data';

export interface SensitiveLogProbe {
  readonly message: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Realistic shapes in which sensitive values leak into logs: credential fields, authorization
 * headers, free-text messages, and payment payloads.
 */
export function sensitiveLogProbe(type: SensitiveValueType, value: string): SensitiveLogProbe {
  switch (type) {
    case 'password':
      return { message: `Submitting login form with password=${value}`, data: { password: value } };
    case 'bearer token':
      return {
        message: `Calling API with Authorization: ${value}`,
        data: { headers: { Authorization: value, Accept: 'application/json' } },
      };
    case 'email address':
      return { message: `Member contact is ${value}`, data: { member: { email: value } } };
    case 'card number':
      return { message: `Payment captured for card ${value}`, data: { payment: { card: value } } };
  }
}
