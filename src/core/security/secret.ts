import { MASK } from './mask';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/**
 * Value object for sensitive strings. Every implicit conversion (string interpolation,
 * JSON.stringify, console/util.inspect) renders the mask. Only `reveal()` returns the value,
 * which makes every use of a secret explicit and reviewable (ADR-009).
 */
export class Secret {
  readonly #value: string;

  public constructor(
    public readonly name: string,
    value: string,
  ) {
    this.#value = value;
  }

  public reveal(): string {
    return this.#value;
  }

  public toString(): string {
    return MASK;
  }

  public toJSON(): string {
    return MASK;
  }

  public [INSPECT](): string {
    return `Secret(${this.name}=${MASK})`;
  }
}
