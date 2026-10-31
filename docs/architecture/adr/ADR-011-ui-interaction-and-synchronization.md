# ADR-011: UI interaction model and synchronization

- Status: Accepted
- Date: 2026-10-31

## Context

Phase 2 introduces the UI interaction layer. Large `BasePage` hierarchies, wrappers around every
Playwright call, and sleeps are the most common causes of slow, flaky and unmaintainable UI suites.
The framework also needs a target application to verify its own UI building blocks without a live
environment.

## Decision

- **Small contracts.** `BasePage` provides only `open()` (navigation with HTTP status check and
  `NavigationError`), `waitUntilLoaded()` (in-app navigation via `waitForURL`) and an abstract
  `waitUntilReady()`. `BaseComponent` provides a scoped `root`, visibility waits and `perform()`.
- **Composition.** Pages compose generic components from `src/interaction/ui/components`
  (`FormComponent`, `TableComponent`, `DialogComponent`, `NotificationComponent`,
  `NavigationComponent`) and domain components from `src/domains/<domain>/components`.
- **Targeted wrapping only.** `perform()` adds structured debug logging and converts failures into
  a `LocatorError` that names the business target and action, keeping the Playwright error as
  `cause`. Plain reads (`isVisible`, `innerText`) are not wrapped.
- **State, not locators, cross layers.** Workflows return plain values (`SearchResults`,
  `DialogState`); steps assert on values. Locators never leave pages or components.
- **Synchronization on application state:**
  - Playwright auto-waiting for actions.
  - Web-first assertions with `ui.expectTimeoutMs` inside components (`toHaveText`, `toHaveCount`).
  - `waitForResponse` started _before_ the triggering click (`submitAndWaitForResponse`).
  - `waitForURL` for navigation.
  - `locator.or()` when either of two valid states may follow an action (accepted vs rejected).
  - `pollUntil` (`src/core/polling`) only for asynchronous backend processing.
  - `waitForTimeout` and `waitForSelector` are lint errors.
- **Accessibility built into components.** `FormComponent.validationMessageFor()` reads the error
  through `aria-errormessage`/`aria-describedby` and fails if a field is invalid without an
  associated message. `DialogComponent.containsFocus()` verifies focus management.
- **Locator hierarchy enforced by lint** in pages and components: positional locators, XPath,
  generated class names, dynamic IDs and long CSS chains require an explicit
  `eslint-disable-next-line … -- <reason>` justification.
- **Local synthetic reference app** (`reference-app/`, `node:http`, no dependencies) serves the
  component gallery. It starts once per run in the Cucumber coordinator when
  `referenceApp.autoStart` is true (only `local`). Phase 5 extends it with the healthcare app/API.

## Alternatives

| Option                                          | Why not chosen                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| Rich `BasePage` with click/fill/type helpers    | Grows into a god class; hides Playwright's auto-waiting semantics   |
| Static HTML via `page.setContent`               | No real navigation, network or response synchronization to exercise |
| Third-party mock server (e.g. MSW, json-server) | Extra dependency for a few routes                                   |
| Screenplay pattern                              | Powerful, but a larger conceptual shift than the team needs now     |

## Reason

Small, composable units keep pages readable, make components reusable across domains, and keep
synchronization explicit and tied to observable application state.

## Consequences

- New UI capability is added as a component or a page method, never in `BasePage`.
- Framework UI self-tests run in seconds against a deterministic local app on all three engines.

## Trade-offs

Workflows return values, so a few assertions that could have been web-first assertions in steps are
instead waits inside components followed by value assertions in steps.
