# ADR-007: Reporting strategy

- Status: Accepted (refined by ADR-013)
- Date: 2026-10-31

## Context

Different consumers need different formats: engineers need rich failure detail, CI systems need
JUnit XML, stakeholders need readable HTML, and traceability tooling needs machine-readable JSON.

## Decision

- Cucumber built-in formatters: `html` → `reports/cucumber/cucumber-report.html`,
  `json` → `reports/cucumber/cucumber-report.json`, `junit` → `reports/junit/junit.xml`.
- Allure (`allure-cucumberjs` + Java-free `allure` CLI) in Phase 4 for history, trends,
  categories and attachments.
- Attachments (screenshots, traces, videos, sanitized logs, sanitized API exchanges,
  accessibility results) are produced by hooks via `ArtifactManager` and attached through the
  Cucumber `attach` API, so every formatter receives them.
- **All text attachments pass through the `Redactor`.**
- Reports are generated even when scenarios fail (`if: always()` in CI).
- Failure classification (`FailureAnalyzer`, Phase 4) adds a category per failed scenario.

## Alternatives

| Option                            | Why not chosen                                                    |
| --------------------------------- | ----------------------------------------------------------------- |
| Allure only                       | Requires generation step; CI test tabs need JUnit                 |
| `multiple-cucumber-html-reporter` | Extra dependency duplicating built-in HTML                        |
| ReportPortal                      | Requires server infrastructure; can be added as a formatter later |

## Reason

Standard, low-dependency formats with one attachment pipeline feeding all of them.

## Consequences

- Report folders are git-ignored and uploaded as CI artifacts with configurable retention.

## Trade-offs

Multiple report formats increase artifact size; retention is kept short (ADR-010).
