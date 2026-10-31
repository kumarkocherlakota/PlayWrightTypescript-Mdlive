/**
 * Default redaction rules for credentials, session data, payment data and healthcare PHI/PII.
 * Keys are compared after lower-casing and removing non-alphanumeric characters, so
 * `Set-Cookie`, `set_cookie` and `setCookie` all match `setcookie`.
 */
export interface RedactionPattern {
  readonly name: string;
  readonly regex: RegExp;
  readonly replace: (match: string, ...groups: string[]) => string;
}

export interface RedactionRules {
  /** Keys masked only on exact (normalized) match; used for short, ambiguous names. */
  readonly exactKeys: readonly string[];
  /** Keys masked when the normalized key contains the fragment. */
  readonly keyFragments: readonly string[];
  readonly patterns: readonly RedactionPattern[];
}

const MASK = '***';

export const DEFAULT_REDACTION_RULES: RedactionRules = {
  exactKeys: [
    'pwd',
    'pin',
    'otp',
    'ssn',
    'dob',
    'mrn',
    'pan',
    'cvv',
    'cvc',
    'email',
    'phone',
    'mobile',
    'address',
    'zip',
    'postalcode',
    'sid',
  ],
  keyFragments: [
    'password',
    'passwd',
    'passphrase',
    'secret',
    'token',
    'authorization',
    'cookie',
    'apikey',
    'privatekey',
    'credential',
    'sessionid',
    'mfacode',
    'socialsecurity',
    'dateofbirth',
    'birthdate',
    'medicalrecord',
    'memberid',
    'subscriberid',
    'patientid',
    'policynumber',
    'insuranceid',
    'groupnumber',
    'cardnumber',
    'accountnumber',
    'routingnumber',
    'firstname',
    'lastname',
    'middlename',
    'fullname',
    'patientname',
    'membername',
    'givenname',
    'familyname',
    'emailaddress',
    'phonenumber',
    'streetaddress',
    'homeaddress',
    'diagnos',
    'medication',
    'reasonforvisit',
    'symptom',
  ],
  patterns: [
    {
      name: 'jwt',
      regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/g,
      replace: () => MASK,
    },
    {
      name: 'authorization-scheme',
      regex: /\b(Bearer|Basic|Digest|Negotiate)\s+[\w.~+/=-]+/gi,
      replace: (_match, scheme) => `${scheme} ${MASK}`,
    },
    {
      name: 'sensitive-assignment',
      regex:
        /\b(password|passwd|pwd|secret|token|access_token|refresh_token|id_token|client_secret|api[_-]?key|code|session(?:id)?)=([^&\s"';,]+)/gi,
      replace: (_match, key) => `${key}=${MASK}`,
    },
    {
      name: 'email',
      regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
      replace: () => MASK,
    },
    {
      name: 'us-ssn',
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      replace: () => MASK,
    },
    {
      name: 'payment-card',
      regex: /\b\d(?:[ -]?\d){12,18}\b/g,
      replace: (match) => (passesLuhn(match) ? MASK : match),
    },
  ],
};

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Luhn check keeps long non-card numbers (timestamps, IDs) readable in logs. */
function passesLuhn(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return digits.length >= 13 && sum % 10 === 0;
}
