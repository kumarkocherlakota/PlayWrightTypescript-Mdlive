# ADR-001: Playwright as the browser and API automation engine

- Status: Accepted
- Date: 2026-10-31

## Context

The framework must automate Chromium, Firefox and WebKit, run in parallel and in CI, call HTTP
APIs for setup and contract validation, and produce traces/videos for failure diagnosis. A single
engine for UI and API reduces the number of authentication and networking stacks to secure.

## Decision

Use the Playwright library (`@playwright/test` package) as the only browser and HTTP engine:

- `Browser` / `BrowserContext` / `Page` for UI automation.
- `APIRequestContext` for all API calls.
- `expect` from `@playwright/test` for web-first assertions.

The Playwright Test runner is **not** the scenario runner (see ADR-002); it may be used later for
non-BDD component tests.

## Alternatives

| Option              | Why not chosen                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Selenium WebDriver  | No built-in auto-waiting or tracing; slower; separate HTTP client needed                                              |
| Cypress             | Single-tab, limited WebKit/Firefox support, in-browser execution model complicates multi-origin and API orchestration |
| WebdriverIO         | Capable, but adds a WebDriver layer and its own runner; less direct trace tooling                                     |
| Axios / got for API | Second networking stack, no shared cookies/storage state with the browser                                             |

## Reason

Auto-waiting, web-first assertions, isolated browser contexts, trace viewer, native WebKit, and a
built-in API client that can share authentication state with the browser.

## Consequences

- Every browser call benefits from auto-waiting, so fixed waits are unnecessary and banned.
- Browser binaries must be installed in CI (`npx playwright install --with-deps`).
- Without the Playwright Test runner, fixtures, retries and tracing must be wired by our own hooks.

## Trade-offs

We give up Playwright Test fixtures and its HTML reporter in exchange for business-readable BDD.
The lifecycle code in `src/core/browser` and `src/bdd/hooks` replaces those fixtures.
