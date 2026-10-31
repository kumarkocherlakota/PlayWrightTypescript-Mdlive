# ADR-002: Cucumber as the BDD specification and execution layer

- Status: Accepted
- Date: 2026-10-31

## Context

Scenarios must be readable by business stakeholders, traceable to requirements, filterable by
tags, and executable in parallel. Gherkin is also the format AI agents generate and review.

## Decision

Use `@cucumber/cucumber` (v13) as the scenario runner with:

- Feature files under `features/`, written in business language only.
- Thin step definitions under `src/bdd/steps/` that delegate to workflows.
- A Custom World (`src/bdd/world/custom-world.ts`) holding typed, scenario-scoped state.
- Lifecycle hooks under `src/bdd/hooks/`.
- Built-in `html`, `json` and `junit` formatters; Allure added in Phase 4.
- `tsx` as the TypeScript loader (`requireModule: ['tsx/cjs']`).
- `--dry-run --strict` as a quality gate for undefined and ambiguous steps.

## Alternatives

| Option                                                   | Why not chosen                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright-bdd` (Gherkin compiled into Playwright Test) | Excellent fixtures, but generated test files and runner coupling make the step layer less portable and the World concept differs from standard Cucumber |
| Plain Playwright Test with `test.step`                   | Not business-readable; no Gherkin traceability                                                                                                          |
| Jest-Cucumber                                            | Smaller ecosystem, weak parallel story                                                                                                                  |

## Reason

Cucumber is the de facto standard for Gherkin execution, has first-class tag expressions,
parallel workers, retry, and standard report formats consumed by CI tools.

## Consequences

- Browser lifecycle, tracing and retries are managed by our hooks (ADR-004).
- Parallelism is process-based: each worker is a separate Node.js process.
- Step definitions use `function` syntax (not arrow functions) so `this` is the World.

## Trade-offs

Extra lifecycle code to maintain, in exchange for runner-independent workflows and stakeholder-
readable specifications. Workflows and page objects do not depend on Cucumber, so they could be
reused from Playwright Test if the decision is revisited.
