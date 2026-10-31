import { setTimeout as delay } from 'node:timers/promises';
import { ValidationError, serializeError } from '@core/errors';

export interface PollOptions {
  /** What is being waited for; used in logs and the timeout error. */
  readonly description: string;
  readonly timeoutMs: number;
  readonly intervalMs?: number;
  /** Multiplier applied to the interval after each attempt (1 = constant interval). */
  readonly backoffFactor?: number;
  readonly maxIntervalMs?: number;
  /** Probe errors matching this predicate are retried; all others fail immediately. */
  readonly retryOn?: (error: unknown) => boolean;
}

export interface PollResult<T> {
  readonly value: T;
  readonly attempts: number;
  readonly elapsedMs: number;
}

const DEFAULTS = { intervalMs: 250, backoffFactor: 1.5, maxIntervalMs: 2_000 } as const;

/**
 * Repeatedly runs `probe` until `isDone` accepts its value. Intended for asynchronous backend
 * processing (e.g. an appointment becoming CONFIRMED). For UI state use Playwright auto-waiting
 * and web-first assertions instead.
 *
 * Fails with a ValidationError carrying the last observed value or probe error, so a timeout is
 * never reported without evidence.
 */
export async function pollUntil<T>(
  probe: () => Promise<T>,
  isDone: (value: T) => boolean,
  options: PollOptions,
): Promise<PollResult<T>> {
  const intervalMs = options.intervalMs ?? DEFAULTS.intervalMs;
  const backoffFactor = options.backoffFactor ?? DEFAULTS.backoffFactor;
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULTS.maxIntervalMs;
  const started = Date.now();
  let wait = intervalMs;
  let attempts = 0;
  let lastObservation: { readonly value: T } | { readonly error: unknown } | undefined;

  for (;;) {
    attempts += 1;
    try {
      const value = await probe();
      if (isDone(value)) {
        return { value, attempts, elapsedMs: Date.now() - started };
      }
      lastObservation = { value };
    } catch (error) {
      if (options.retryOn?.(error) !== true) {
        throw error;
      }
      lastObservation = { error };
    }

    const elapsed = Date.now() - started;
    if (elapsed >= options.timeoutMs) {
      throw new ValidationError(
        `Timed out after ${elapsed} ms (${attempts} attempts) waiting for ${options.description}.`,
        { context: { attempts, elapsedMs: elapsed, ...describe(lastObservation) } },
      );
    }
    await delay(Math.min(wait, options.timeoutMs - elapsed));
    wait = Math.min(wait * backoffFactor, maxIntervalMs);
  }
}

function describe(
  observation: { readonly value: unknown } | { readonly error: unknown } | undefined,
): Record<string, unknown> {
  if (observation === undefined) {
    return {};
  }
  return 'error' in observation
    ? { lastError: serializeError(observation.error) }
    : { lastValue: observation.value };
}
