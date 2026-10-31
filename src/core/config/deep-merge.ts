export type PlainObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Merges configuration layers left to right. Later layers win; nested objects merge; arrays and
 * scalars replace; `undefined` never overwrites a value.
 */
export function deepMerge(...layers: readonly unknown[]): PlainObject {
  const result: PlainObject = {};
  for (const layer of layers) {
    if (!isPlainObject(layer)) {
      continue;
    }
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined) {
        continue;
      }
      const existing = result[key];
      result[key] =
        isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
    }
  }
  return result;
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}
