import { FrameworkError } from '@core/errors';

/**
 * Scenario-scoped, typed key/value state. A new instance is created for every scenario attempt,
 * so nothing can leak between scenarios or parallel workers.
 */
export class ScenarioContext<TState extends object> {
  private readonly values: Partial<TState> = {};

  public set<Key extends keyof TState>(key: Key, value: TState[Key]): void {
    this.values[key] = value;
  }

  /** Returns the stored value or fails with the missing key, never a silent undefined. */
  public get<Key extends keyof TState>(key: Key): TState[Key] {
    if (!this.has(key)) {
      throw new FrameworkError(
        `Scenario state "${String(key)}" was read before it was stored. Check the step order in the scenario.`,
        { context: { key: String(key) } },
      );
    }
    return this.values[key] as TState[Key];
  }

  public find<Key extends keyof TState>(key: Key): TState[Key] | undefined {
    return this.values[key];
  }

  public has(key: keyof TState): boolean {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  public keys(): string[] {
    return Object.keys(this.values);
  }
}
