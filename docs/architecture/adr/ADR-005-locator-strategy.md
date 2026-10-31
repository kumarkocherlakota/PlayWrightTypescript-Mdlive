# ADR-005: Locator strategy

- Status: Accepted
- Date: 2026-10-31

## Context

Brittle selectors are the main source of UI test maintenance and flakiness. Locators that mirror
how users perceive the page also surface accessibility defects.

## Decision

Locators are defined **only** in Page and Component Objects, in this priority order:

1. `getByRole` with accessible name
2. `getByLabel`
3. `getByPlaceholder`
4. `getByText` (only when stable and unique)
5. `getByTestId` (attribute configurable, default `data-testid`)
6. Stable CSS selector (short, no generated classes or dynamic IDs)
7. XPath — last resort, with a written justification

Rules:

- Locators must resolve to exactly one element (Playwright strict mode stays on).
- Positional locators (`nth`, `first`, `last`) require a justification comment.
- Components scope their locators to a root locator so they are reusable in lists.
- When evidence (DOM, accessibility tree, screenshot) is insufficient, the Locator agent must
  request it rather than invent a locator, and may recommend a `data-testid`.

## Alternatives

| Option                            | Why not chosen                                                          |
| --------------------------------- | ----------------------------------------------------------------------- |
| `data-testid` first               | Stable but hides accessibility gaps and requires app changes everywhere |
| CSS/XPath recorded selectors      | Brittle against layout and styling changes                              |
| Central locator repository (JSON) | Separates locators from behavior; loses type safety                     |

## Reason

User-facing locators follow Playwright guidance, stay stable through refactors, and double as an
accessibility signal.

## Consequences

- Inaccessible elements become visible as locator problems and are reported.
- Some applications will need `data-testid` attributes added by developers.

## Trade-offs

Text-based locators can be affected by copy or localization changes; tests run with a fixed
locale (`ui.locale`) and prefer role + name over raw text.
