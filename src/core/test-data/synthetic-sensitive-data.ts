import { randomBytes, randomInt } from 'node:crypto';

export const SENSITIVE_VALUE_TYPES = [
  'password',
  'bearer token',
  'email address',
  'card number',
] as const;
export type SensitiveValueType = (typeof SENSITIVE_VALUE_TYPES)[number];

/**
 * Generates random, clearly synthetic sensitive-looking values for masking and security tests.
 * Values are never real credentials; e-mail addresses use the reserved `.test` TLD and card
 * numbers use the 4000 test prefix.
 */
export function syntheticSensitiveValue(type: SensitiveValueType): string {
  switch (type) {
    case 'password':
      return `Syn-${randomBytes(12).toString('base64url')}!9`;
    case 'bearer token':
      return `Bearer ${randomBytes(24).toString('base64url')}`;
    case 'email address':
      return `synthetic.${randomBytes(4).toString('hex')}@example.test`;
    case 'card number':
      return syntheticCardNumber();
  }
}

function syntheticCardNumber(): string {
  const body = `4000${Array.from({ length: 11 }, () => randomInt(10)).join('')}`;
  return `${body}${luhnCheckDigit(body)}`;
}

function luhnCheckDigit(body: string): number {
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    let digit = Number(body[body.length - 1 - index]);
    if (index % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}
