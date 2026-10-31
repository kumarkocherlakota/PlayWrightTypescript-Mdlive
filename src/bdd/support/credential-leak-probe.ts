/**
 * Finds credentials that escaped redaction in log text: JWT-shaped tokens, bearer or basic
 * authorization values that are not masked, and OAuth form fields carrying a value.
 * Returns the kinds of leak found, never the leaked values themselves.
 */
const LEAK_PATTERNS: readonly { readonly kind: string; readonly regex: RegExp }[] = [
  { kind: 'JWT', regex: /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\./ },
  { kind: 'authorization value', regex: /\b(?:Bearer|Basic)\s+(?!\*\*\*)[\w.~+/=-]{8,}/i },
  {
    kind: 'credential form field',
    regex: /\b(?:password|client_secret|access_token|refresh_token)=(?!\*\*\*)[^&\s"]+/i,
  },
];

export function findCredentialLeaks(text: string): string[] {
  return LEAK_PATTERNS.filter(({ regex }) => regex.test(text)).map(({ kind }) => kind);
}
