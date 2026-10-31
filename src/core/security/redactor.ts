import { serializeError } from '@core/errors';
import { MASK } from './mask';
import { DEFAULT_REDACTION_RULES, normalizeKey, type RedactionRules } from './redaction-rules';
import { Secret } from './secret';

const MAX_DEPTH = 20;
/** Values shorter than this are not registered for free-text masking to avoid over-masking. */
const MIN_REGISTERED_VALUE_LENGTH = 4;

/**
 * Masks sensitive data in text and structured values before anything is logged, attached to a
 * report, or written as an artifact. Redaction never mutates the input.
 */
export class Redactor {
  private readonly exactKeys: ReadonlySet<string>;
  private readonly keyFragments: readonly string[];
  private readonly knownValues = new Set<string>();

  public constructor(private readonly rules: RedactionRules = DEFAULT_REDACTION_RULES) {
    this.exactKeys = new Set(rules.exactKeys.map(normalizeKey));
    this.keyFragments = rules.keyFragments.map(normalizeKey);
  }

  /** Registers a concrete secret value so it is masked wherever it appears in free text. */
  public registerSensitiveValue(value: string): void {
    if (value.length >= MIN_REGISTERED_VALUE_LENGTH) {
      this.knownValues.add(value);
    }
  }

  public isSensitiveKey(key: string): boolean {
    const normalized = normalizeKey(key);
    return (
      this.exactKeys.has(normalized) ||
      this.keyFragments.some((fragment) => normalized.includes(fragment))
    );
  }

  public redactText(text: string): string {
    let result = text;
    for (const value of this.knownValues) {
      result = result.split(value).join(MASK);
    }
    for (const pattern of this.rules.patterns) {
      result = result.replace(new RegExp(pattern.regex.source, pattern.regex.flags), (...args) =>
        pattern.replace(...matchArguments(args)),
      );
    }
    return result;
  }

  /** Returns a JSON-safe deep copy of `value` with sensitive keys and patterns masked. */
  public redact(value: unknown): unknown {
    return this.redactValue(value, new WeakSet<object>(), 0);
  }

  private redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
    if (typeof value === 'string') {
      return this.redactText(value);
    }
    if (value === null || typeof value !== 'object') {
      return typeof value === 'bigint' ? value.toString() : value;
    }
    if (value instanceof Secret) {
      return MASK;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (seen.has(value)) {
      return '[Circular]';
    }
    if (depth >= MAX_DEPTH) {
      return '[MaxDepth]';
    }
    seen.add(value);

    if (value instanceof Error) {
      return this.redactValue(serializeError(value), seen, depth + 1);
    }
    if (Array.isArray(value)) {
      return value.map((item: unknown) => this.redactValue(item, seen, depth + 1));
    }
    if (value instanceof Map) {
      return this.redactEntries(
        [...value.entries()].map(([k, v]) => [String(k), v]),
        seen,
        depth,
      );
    }
    return this.redactEntries(Object.entries(value), seen, depth);
  }

  private redactEntries(
    entries: readonly (readonly [string, unknown])[],
    seen: WeakSet<object>,
    depth: number,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      output[key] = this.isSensitiveKey(key) ? MASK : this.redactValue(entryValue, seen, depth + 1);
    }
    return output;
  }
}

/**
 * String.replace passes (match, ...groups, offset, input[, namedGroups]). Groups end where the
 * numeric offset starts; non-participating groups arrive as undefined and become ''.
 */
function matchArguments(args: unknown[]): [string, ...string[]] {
  const [match, ...rest] = args;
  const offsetIndex = rest.findIndex((item) => typeof item === 'number');
  const groups = rest
    .slice(0, offsetIndex === -1 ? rest.length : offsetIndex)
    .map((group) => (typeof group === 'string' ? group : ''));
  return [String(match), ...groups];
}
