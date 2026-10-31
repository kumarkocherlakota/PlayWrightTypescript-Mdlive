import type { AppointmentPolicy, FrameworkConfig } from '@core/config';
import { ConfigurationError, TestDataError } from '@core/errors';

export const POLICY_LIMITS = ['booking horizon', 'cancellation cutoff'] as const;
export type PolicyLimit = (typeof POLICY_LIMITS)[number];

export const LIMIT_SIDES = ['inside', 'outside'] as const;
/** `inside` is closer to now than the limit; `outside` is further away. */
export type LimitSide = (typeof LIMIT_SIDES)[number];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * The appointment rules of the environment under test. They are not invented here: environments
 * whose rules are unconfirmed leave `healthcare.appointmentPolicy` unset, and every scenario that
 * depends on them fails with this ConfigurationError (CLARIFICATIONS C-04, C-06, C-08).
 */
export function requireAppointmentPolicy(config: FrameworkConfig): AppointmentPolicy {
  const policy = config.healthcare.appointmentPolicy;
  if (policy === undefined) {
    throw new ConfigurationError(
      `healthcare.appointmentPolicy is not configured for environment "${config.environment}". ` +
        'Set the confirmed booking horizon, cancellation cutoff and reason-for-visit length before running appointment scenarios.',
      { context: { environment: config.environment } },
    );
  }
  return policy;
}

/**
 * Offset from now, in milliseconds, of a time `marginMinutes` inside or outside a policy limit.
 * Boundary scenarios use a margin of a few minutes so test duration cannot move a time across
 * the limit.
 */
export function offsetFromLimit(
  policy: AppointmentPolicy,
  limit: PolicyLimit,
  side: LimitSide,
  marginMinutes: number,
): number {
  if (!Number.isInteger(marginMinutes) || marginMinutes <= 0) {
    throw new TestDataError(
      `The margin must be a positive whole number of minutes, got ${marginMinutes}.`,
    );
  }
  const limitMs =
    limit === 'booking horizon'
      ? policy.bookingHorizonDays * DAY_MS
      : policy.cancellationCutoffHours * HOUR_MS;
  const marginMs = marginMinutes * MINUTE_MS;
  return side === 'inside' ? limitMs - marginMs : limitMs + marginMs;
}
