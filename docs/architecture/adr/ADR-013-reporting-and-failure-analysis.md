# ADR-013: Reporting pipeline, failure evidence and failure classification

- Status: Accepted
- Date: 2026-10-31
- Refines: ADR-007

## Context

Phase 4 makes failed runs diagnosable without re-running them. People reading the reports need
the same answer from every format: what failed, the likely cause, who should act first, and the
evidence. Retries must not hide instability. Evidence must never spread credentials, PHI or PII
(ADR-009, ADR-010).

## Decision

- **One runner for every test script** (`tools/run/run-cucumber.ts`). It clears the previous
  run's raw results, runs Cucumber, and then always writes the failure analysis, whether the run
  passed or failed. It exits with Cucumber's code. If the analysis cannot be written, a run that
  would have passed exits with code 2 instead. Only for `TEST_ENV=local` does it generate
  throwaway synthetic credentials, as described in ADR-012.
- **Formatters** (`cucumber.mjs`):
  - Cucumber's built-in `progress`, `html`, `json` and `junit` formatters, as before.
  - A `message` NDJSON stream (`reports/cucumber/messages.ndjson`). It records every attempt,
    step result and exception type, and it is the input for the analysis.
  - `allure-cucumberjs/reporter`, writing to `reports/allure-results`. It runs together with the
    other formatters and gets its own output file, so `progress` keeps stdout.
  - All report paths live in `config/report-paths.json`. `cucumber.mjs`, `allurerc.mjs` and the
    tools all read that file.
- **One classifier, used in three places** (`src/core/failure-analysis`):
  - It applies ordered rules to the evidence. Undefined, pending and ambiguous steps come first.
    Then come FrameworkError codes (or the class name, after the run). Then the messages of
    Playwright, Cucumber and the network. Each failure gets exactly one category: automation gap,
    configuration, test data, authentication, environment, contract, unexpected API response,
    locator, timeout, assertion, or unclassified. The result also carries an owner hint and
    guidance.
  - **During the run**, the `After` hook logs the classification at error level and attaches it
    to every failed attempt as `failure-classification.json`.
  - **After the run**, `tools/failure-analysis` reads the messages stream and writes
    `reports/analysis/failure-analysis.json` and `.md`. Each scenario is counted once, by its
    final attempt.
  - **In Allure**, `allurerc.mjs` loads the same TypeScript classifier through `tsx` and defines
    one category per classifier category, so the Allure report never disagrees with the analysis.
  - Categories are triage hints and never change a pass/fail result.
- **Flaky means "failed, then passed on retry within the run".** The analysis lists flaky
  scenarios separately, together with the failure that preceded the pass. Allure 3 only detects
  flakiness from history, so after the run the tool sets the standard `statusDetails.flaky` flag
  on the latest passing result of any test (identified by its `historyId`) that failed earlier in
  the same run.
- **Failure evidence:**
  - UI, attached on failure: a screenshot; `ui-diagnostics.json` with console errors, failed
    requests and HTTP responses of status 400 or above, recorded as method, origin and path with
    no query string; and the recorded video (`video/webm`).
  - Videos larger than `artifacts.maxAttachmentMb` (default 25) stay on disk and are referenced
    by path.
  - API: the existing redacted `api-exchanges.json` (ADR-012).
  - All scenarios: the redacted scenario log.
- **Traces are referenced, never embedded.** Playwright traces can record request headers,
  cookies and page content. A trace zip cannot be redacted, so it stays on disk under
  `reports/traces`. `ui-artifacts.json` gives its path and the `npx playwright show-trace`
  command to open it.
- **Report generation:** `npm run report:allure` writes `reports/allure-report` and keeps trend
  history in `reports/allure-history/history.jsonl`, limited to 30 runs. `npm run report:analyze`
  re-runs the analysis on its own.

## Alternatives

| Option                                                   | Why not chosen                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Allure regex categories in `allurerc` only               | Duplicates classification rules; Allure and the analysis would drift apart         |
| Allure `failureCategory` label set from the `After` hook | Allure rejects metadata from after-fixtures ("metadata messages isn't supported")  |
| Parse `cucumber-report.json` for the analysis            | Has no attempt numbers or `willBeRetried`, so flaky scenarios cannot be told apart |
| Embed trace zips in reports                              | Traces can contain unredactable headers, cookies and page data; reports are shared |
| Post-process reports in a separate npm script            | Easy to forget; an unanalysed failing run is the case that matters most            |
| Machine-learning classification                          | No labelled failure history exists; rules are explainable and testable             |

## Reason

When the classification is computed once and reused, every report gives the same answer. The
messages stream is the only output that keeps retry information, so the analysis builds on it.
Keeping untrusted binary artifacts out of shareable reports applies ADR-009 and ADR-010 without
losing any evidence.

## Consequences

- New error types should extend `FrameworkError` with a stable `code`. Any other error is
  classified from its message and is more likely to end up unclassified.
- A new classifier category automatically appears in the `After` hook output, the analysis and
  Allure.
- CI (Phase 6) uploads `reports/**` even when the run fails, and restores and saves
  `reports/allure-history` between runs.

## Trade-offs

- Message-based rules depend on the wording of Playwright and Cucumber messages. Unit tests pin
  the current wording, and an unmatched message falls back to `unclassified` instead of being
  misfiled.
- Reading a trace takes one extra step: running `show-trace` against the retained file.
