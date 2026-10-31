/** What a response's headers protect against; derived only from the headers, never assumed. */
export interface SecurityHeaderAssessment {
  /** `frame-ancestors 'none'|'self'` or `X-Frame-Options: DENY|SAMEORIGIN` (clickjacking). */
  readonly framingBlocked: boolean;
  /** The effective script policy does not allow inline script (XSS mitigation). */
  readonly inlineScriptBlocked: boolean;
  /** `X-Content-Type-Options: nosniff`. */
  readonly contentSniffingBlocked: boolean;
  /** A Referrer-Policy that does not send full URLs to other origins. */
  readonly referrerLimited: boolean;
}

const LIMITING_REFERRER_POLICIES = new Set([
  'no-referrer',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
]);

/**
 * Assesses the browser-enforced protections a response declares. Header names are matched
 * case-insensitively. Inline script counts as allowed when the effective `script-src` (or
 * `default-src`) is missing or contains `'unsafe-inline'` without a nonce or hash, because
 * browsers ignore `'unsafe-inline'` once a nonce or hash is present (CSP Level 2).
 */
export function assessSecurityHeaders(
  headers: Readonly<Record<string, string>>,
): SecurityHeaderAssessment {
  const header = (name: string): string | undefined =>
    Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  const csp = parseContentSecurityPolicy(header('content-security-policy') ?? '');
  const frameAncestors = csp.get('frame-ancestors');
  const frameOptions = (header('x-frame-options') ?? '').trim().toUpperCase();
  const scriptSources = csp.get('script-src') ?? csp.get('default-src');
  const referrerPolicies = (header('referrer-policy') ?? '')
    .split(',')
    .map((policy) => policy.trim().toLowerCase())
    .filter((policy) => policy !== '');
  const effectiveReferrerPolicy = referrerPolicies.at(-1);

  return {
    framingBlocked:
      frameAncestors !== undefined
        ? frameAncestors.length > 0 &&
          frameAncestors.every((source) => source === "'none'" || source === "'self'")
        : frameOptions === 'DENY' || frameOptions === 'SAMEORIGIN',
    inlineScriptBlocked:
      scriptSources !== undefined &&
      (!scriptSources.includes("'unsafe-inline'") ||
        scriptSources.some((source) => /^'(nonce|sha256|sha384|sha512)-/.test(source))),
    contentSniffingBlocked:
      (header('x-content-type-options') ?? '').trim().toLowerCase() === 'nosniff',
    referrerLimited:
      effectiveReferrerPolicy !== undefined &&
      LIMITING_REFERRER_POLICIES.has(effectiveReferrerPolicy),
  };
}

/** Directive name → source list; the first occurrence of a directive wins, as in browsers. */
function parseContentSecurityPolicy(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name !== undefined && name !== '' && !directives.has(name.toLowerCase())) {
      directives.set(name.toLowerCase(), sources);
    }
  }
  return directives;
}
