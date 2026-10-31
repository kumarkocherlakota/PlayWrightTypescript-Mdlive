# ADR-004: Browser and context lifecycle

- Status: Accepted
- Date: 2026-10-31

## Context

Scenarios must be isolated (cookies, storage, permissions) and parallel-safe, while browser
launches are expensive. Cucumber parallelism uses separate worker processes.

## Decision

- **One `Browser` per worker process**, launched lazily by `BrowserManager` on the first `@ui`
  scenario and closed in `AfterAll`.
- **One `BrowserContext` and `Page` per scenario**, created in a `Before({ tags: '@ui' })` hook
  and closed in `After`. Wrapped by `UiSession`.
- Context options (viewport/device, locale, time zone, base URL, video, timeouts) come from the
  validated configuration.
- Tracing starts with the context and is kept only according to `artifacts.trace` policy.
- API-only scenarios never launch a browser; they get their own `APIRequestContext` (Phase 3).
- Authentication state may be reused per role via storage-state files created per worker, never
  shared across workers (Phase 3).

## Alternatives

| Option                               | Why not chosen                                          |
| ------------------------------------ | ------------------------------------------------------- |
| New browser per scenario             | Full isolation but several hundred ms per scenario      |
| One context per worker               | Fast but leaks cookies/storage between scenarios        |
| Browser server shared across workers | Extra moving parts; little benefit with process workers |

## Reason

Contexts give full isolation at low cost; process-scoped browsers avoid cross-worker sharing.

## Consequences

- The only module-level mutable state is the per-process browser handle in `BrowserManager`.
- Scenarios must not rely on state left by other scenarios.

## Trade-offs

A browser crash affects all remaining scenarios in that worker; `BrowserManager` relaunches when
it detects a disconnected browser.
