# ADR-008: Parallel execution and sharding

- Status: Accepted
- Date: 2026-10-31

## Context

Regression suites must finish quickly across three browsers. Parallelism exposes any shared state.

## Decision

- Cucumber `parallel` workers (`PARALLEL_WORKERS`, default `1` locally, CI sets it per runner).
- Browser matrix in CI: one job per browser (`BROWSER=chromium|firefox|webkit`).
- Sharding across CI jobs by splitting feature paths or tag expressions (Phase 6).
- Retries only when `CI=true` (`RETRIES`, default `2` in CI, `0` locally). A scenario that passes
  on retry is reported as **flaky**, never as a clean pass.
- No mutable module-level state except the per-process browser handle and frozen configuration.
- Each scenario owns its context, data, and cleanup (ADR-004, ADR-006).
- Scenarios that cannot run in parallel must be tagged `@serial` and are run in a separate,
  single-worker pass (Cucumber `parallelCanAssign`).

## Alternatives

| Option                   | Why not chosen                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| Thread-based parallelism | Not supported by Cucumber; Playwright objects are not thread-shareable |
| Retries everywhere       | Hides real defects locally                                             |

## Reason

Process isolation gives strong guarantees with Cucumber's native support.

## Consequences

- Each worker launches its own browser; memory scales with worker count.
- Logs include worker ID to make interleaved output traceable.

## Trade-offs

Higher memory footprint per worker in exchange for isolation.
