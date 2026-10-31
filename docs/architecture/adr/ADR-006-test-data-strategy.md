# ADR-006: Test-data strategy

- Status: Accepted
- Date: 2026-10-31

## Context

Scenarios run in parallel against shared environments. Healthcare data is highly sensitive, and
real patient data must never be used.

## Decision

- **Synthetic data only**, produced by builders and factories in each domain's `builders/`.
- **Unique per scenario:** identifiers combine run ID, worker ID and a sequence number
  (`src/core/test-data`, Phase 3), so parallel scenarios never collide.
- **Deterministic when needed:** seeded random generation (seed logged, not the data) so a failing
  scenario can be reproduced.
- **API-based setup and cleanup:** scenarios create what they need via domain API clients and
  register cleanup actions in a per-scenario cleanup registry executed in `After`, even on failure.
- **Environment-specific reference data** (e.g., known provider specialties) lives in non-secret
  configuration, never in feature files as IDs.
- Synthetic values are still masked in logs, so the redaction path is exercised continuously.

## Alternatives

| Option                             | Why not chosen                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Shared seeded accounts and records | Parallel scenarios mutate the same data                                         |
| Database seeding/snapshots         | Requires DB access that test environments rarely grant; couples tests to schema |
| Masked production copies           | Re-identification risk; prohibited for PHI                                      |

## Reason

Independence, parallel safety, and privacy by construction.

## Consequences

- Domain APIs for setup/cleanup are a prerequisite for high-value scenarios (see C-14).
- Cleanup failures are reported as errors, never swallowed.

## Trade-offs

More setup code per scenario and dependence on API availability for UI scenarios.
