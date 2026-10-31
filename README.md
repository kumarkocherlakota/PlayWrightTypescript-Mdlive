# Universal Playwright Automation Framework

Playwright + TypeScript + Cucumber BDD framework for UI, API and UI+API testing, with a healthcare
reference domain (provider search and appointment booking).

> **Status: Phases 1–6 complete** (foundation, core UI framework, API framework, reporting and
> failure analysis, healthcare use case with traceability, and accessibility, security, CI,
> Docker, flakiness analysis and Cursor agents). See
> [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md). This README is
> expanded in Phase 7.

## Requirements

- Node.js 22.13+ (`.nvmrc`)
- npm 10+

## Setup

```bash
npm ci
npx playwright install chromium        # add firefox webkit for cross-browser runs
cp .env.example .env                   # optional, for local values; never commit .env
```

Behind a TLS-intercepting corporate proxy, browser downloads can fail with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Point Node.js at your organization's CA bundle:
`NODE_EXTRA_CA_CERTS=/path/to/ca-bundle.pem npx playwright install chromium`.

## Configuration

Precedence: defaults (`src/core/config/config-defaults.ts`) → `config/environments/<env>.json` →
environment variables → runtime overrides. The result is validated and frozen at startup; any
problem stops the run with a `ConfigurationError` that lists each invalid setting.

| Variable                                           | Purpose                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `TEST_ENV`                                         | `local`, `dev`, `qa` (default) or `staging`                                   |
| `UI_BASE_URL`, `API_BASE_URL`, `AUTH_BASE_URL`     | Service endpoints (required for dev/qa/staging)                               |
| `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`            | Synthetic test user, read as masked `Secret` values                           |
| `API_AUTH_METHOD`                                  | `oauth2-password` (default), `oauth2-client-credentials`, `api-key` or `none` |
| `API_CLIENT_ID`, `API_CLIENT_SECRET`, `API_KEY`    | Secrets for the client-credentials grant or API-key auth                      |
| `BROWSER`, `BROWSER_CHANNEL`, `DEVICE`, `HEADLESS` | Browser selection                                                             |
| `LOCALE`, `TIMEZONE`                               | Browser locale and time zone                                                  |
| `PARALLEL_WORKERS`, `CI`, `RETRIES`, `TAGS`        | Runner switches (retries apply only when `CI=true`)                           |
| `SHARD`                                            | `<index>/<total>`: run one shard of the selected scenarios                    |
| `SECURITY_AUTHORIZED_HOSTS`                        | Hosts `@security` scenarios may run against (comma-separated, `*.domain`)     |

See [`.env.example`](.env.example) for the full list.

## Commands

| Command                                                           | What it does                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run validate`                                                | Format check, lint, type check, boundaries, unit tests, BDD checks, traceability    |
| `npm run test:framework`                                          | Framework self-checks (UI and API) against the local synthetic reference app        |
| `npm run test:healthcare`                                         | Healthcare use case (UI, API, UI + API) against the local synthetic patient portal  |
| `npm run test:integration`                                        | Only the `@integration` (UI + API) scenarios                                        |
| `npm run traceability`                                            | Regenerates `docs/traceability/traceability-matrix.md` from the feature tags        |
| `npm run traceability:check`                                      | Fails on broken requirement links or when the committed matrix is out of date       |
| `npm test`                                                        | All non-`@wip` scenarios for `TEST_ENV` (default `qa`)                              |
| `npm run test:smoke` / `test:regression` / `test:ui` / `test:api` | Tag-based profiles                                                                  |
| `npm run test:unit`                                               | Unit tests for framework code (`node:test`); UI-layer tests need Chromium installed |
| `npm run bdd:check`                                               | Fails on undefined or ambiguous steps                                               |
| `npm run bdd:usage`                                               | Lists step definitions and unused steps                                             |
| `npm run bdd:unused`                                              | Fails when a step definition is not used by any feature                             |
| `npm run bdd:lint`                                                | Gherkin lint: tags, selectors/waits in steps, duplicates, broken outlines           |
| `npm run arch:check`                                              | Layer, domain-boundary and circular-dependency rules                                |
| `npm run report:allure` / `report:open`                           | Builds `reports/allure-report` from the last run (with trend history) / serves it   |
| `npm run report:analyze`                                          | Re-runs the failure analysis on the last run's `reports/cucumber/messages.ndjson`   |
| `npm run report:flakiness [browser]`                              | Adds the last run to `reports/flakiness/history.jsonl` and rewrites the report      |
| `npm run security:scan-reports`                                   | Scans `reports/` for unredacted secrets and personal data (exit 1 on findings)      |
| `npm run agents:lint`                                             | Checks the Cursor agent definitions in `.cursor/agents`                             |
| `npm run reference-app`                                           | Starts the local synthetic reference app at `http://localhost:4000/gallery`         |

Examples:

```bash
PARALLEL_WORKERS=4 npm run test:framework
BROWSER=firefox npm run test:framework
PARALLEL_WORKERS=4 npm run test:healthcare
DEVICE="iPhone 15" BROWSER=webkit npm run test:healthcare
SHARD=2/3 npm run test:healthcare                   # second of three shards
npm run test:healthcare -- --tags @accessibility    # narrows the profile's tags
```

## Writing UI tests

Follow the dependency direction: feature → step → workflow → page/component. The
`src/domains/component-gallery/` domain is the working template.

1. **Page** (`src/domains/<domain>/pages/`): extend `BasePage`, set `path` and `name`, implement
   `waitUntilReady()` with a web-first assertion, and compose components.
2. **Components:** reuse `FormComponent`, `TableComponent`, `DialogComponent`,
   `NotificationComponent` and `NavigationComponent` from `@interaction/ui`. Add domain-specific
   components under `src/domains/<domain>/components/`, extending `BaseComponent`.
3. **Locators** follow ADR-005: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` →
   `getByTestId` → short CSS → XPath. Lint rejects positional, XPath, generated-class and
   dynamic-ID locators unless the line carries a justified `eslint-disable-next-line`.
4. **Workflow** (`src/domains/<domain>/workflows/`): coordinate pages and return plain values.
5. **Export** through `src/domains/<domain>/index.ts`; steps import only that file.
6. **Synchronize on state** (ADR-011): auto-waiting, web-first assertions, `waitForResponse`
   started before the click, `waitForURL`, and `pollUntil` from `@core/polling` for backend work.
   Never `waitForTimeout`.

Tag policy and step-wording rules for `bdd:lint` live in `config/gherkin-lint.json`; adjust it when
onboarding a project.

## Writing API tests

`src/domains/inventory/` is the working template (ADR-012). Tag API scenarios `@api` (or
`@integration` for UI+API); the framework then opens an isolated API session for the scenario.

1. **Model** (`models/`): the business types, plus `RequestOutcome<T>` for requests that may be
   rejected.
2. **Contract** (`schemas/`): a JSON Schema typed as `ContractSchema<T>`, so the compiler rejects
   a schema that does not match the model.
3. **Builder** (`builders/`): valid synthetic data by default, unique through the worker's
   `UniqueIdGenerator` and marked with `healthcare.syntheticDataMarker`.
4. **Client** (`api/`): wraps `HttpClient`; normal methods enforce the expected status and validate
   the contract, `attempt…` methods return rejections as values for negative tests.
5. **Validator** (`validators/`): business rules that a schema cannot express.
6. **Workflow** (`workflows/`): register a cleanup action immediately after creating anything:
   `api.cleanup.register('delete … <id>', () => client.deleteIfPresent(id))`. Cleanup runs after
   every scenario, even failed ones; a cleanup failure fails the scenario.

Authentication follows `auth.apiMethod`; clients never see tokens or keys. For negative security
tests use `session.clientWith(new NoAuth())`, `new StaticBearerAuth(...)` or
`session.passwordGrant(...)` with synthetic credentials.

Against `local`, no setup is needed: `npm run test:framework` generates a throwaway synthetic test
user in memory when `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are unset, and the local identity
provider accepts exactly the credentials of the run. Other environments need the secrets of their
configured `auth.apiMethod`.

## Reports and artifacts

Every `npm test*` script runs through `tools/run/run-cucumber.ts`. It clears the previous run's
raw results, runs Cucumber, and then always writes the failure analysis, whether the run passed or
failed. The exit code is Cucumber's. All output goes to `reports/` (git-ignored); the paths are
defined in `config/report-paths.json`.

| Output                                        | Contents                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `reports/analysis/failure-analysis.md`        | Totals, failures by category, each failed and flaky scenario with cause, owner and next step |
| `reports/analysis/failure-analysis.json`      | The same, machine-readable                                                                   |
| `reports/cucumber/cucumber-report.html`       | Cucumber HTML report with every attachment                                                   |
| `reports/cucumber/cucumber-report.json`       | Cucumber JSON                                                                                |
| `reports/cucumber/messages.ndjson`            | Raw Cucumber event stream (input for the analysis)                                           |
| `reports/junit/junit.xml`                     | JUnit XML for CI test tabs                                                                   |
| `reports/allure-results`                      | Allure raw results; `npm run report:allure` turns them into `reports/allure-report`          |
| `reports/logs/worker-<id>.jsonl`              | Structured, redacted logs per worker                                                         |
| `reports/traceability/traceability-matrix.md` | Traceability matrix and coverage summaries with this run's result per scenario               |
| `reports/screenshots`, `traces`, `videos`     | Kept according to the artifact policy (default: on failure only)                             |

**Failure classification** (ADR-013). Each failed attempt gets one category: automation gap,
configuration, test data, authentication, environment, API contract, unexpected API response, UI
locator, timeout, assertion, or unclassified. The same classifier feeds three places: the
`failure-classification.json` attachment, the analysis, and the Allure categories. A category is a
triage hint, not a verdict. Confirm it against the evidence. Throw a `FrameworkError` subclass from
new code so its failures are classified by code rather than by message.

**Flaky scenarios** failed and then passed on a retry (`CI=true`, `RETRIES`). They are listed
separately in the analysis and grouped under "Flaky" in Allure.

**Evidence on failure:**

- UI scenarios: a screenshot, `ui-diagnostics.json` (console errors, failed requests, HTTP
  responses ≥ 400, with no query strings) and the video. Videos larger than
  `artifacts.maxAttachmentMb` (default 25) stay on disk and are referenced by path.
- API scenarios: `api-exchanges.json`.
- Every scenario: the redacted scenario log.

Traces are never embedded in reports, because they can contain request headers, cookies and page
data that cannot be redacted. `ui-artifacts.json` gives the trace path and the command to open
it: `npx playwright show-trace reports/traces/<file>.zip`. Treat retained traces and videos as
sensitive, and keep CI retention short.

## Project layout

```text
features/            Gherkin specifications
src/bdd/             World, hooks, steps, parameter types
src/domains/         Business domains (component-gallery: UI template, inventory: API template, healthcare: authentication, providers, appointments)
src/interaction/ui/  BasePage, BaseComponent and generic components
src/interaction/api/ ApiSession, HttpClient, auth strategies, SchemaValidator
src/core/            Config, errors, failure classification, logging, security, artifacts, browser lifecycle, polling, test data
reference-app/       Local synthetic app and API used by self-tests (no real data)
tools/               Test runner, failure analysis, Gherkin linter, unused-step check, traceability, agent lint, report leak scan, flakiness history
config/environments/ Non-secret environment settings
docs/architecture/   Architecture, ADRs, clarification list
docs/traceability/   Requirements catalogue, traceability matrix, automation decisions
.cursor/rules/       Governance rules RULE-001 … RULE-018
.cursor/agents/      Sixteen specialized Cursor agents
.github/             CI workflows, shared setup action, Dependabot
docker/              Test-runner image and compose file
tests/unit/          Unit tests for framework code
```

## Healthcare use case and traceability

The reference use case (ADR-014) covers portal sign-in, provider search, booking, the dashboard
and cancellation. It runs against a synthetic patient portal in the local reference app
(`npm run reference-app`, then open `/portal`). Booking rules come from
`healthcare.appointmentPolicy` in the environment file; an environment without it fails the
affected scenarios instead of guessing (clarifications C-04, C-06, C-08).

Tags choose the sessions: `@ui` (browser), `@api` (API), `@integration` (UI + API in one
scenario) and `@api-setup` (UI scenario that seeds its data through the API). `@manual` and
`@blocked` scenarios are traced but never run.

Every healthcare scenario carries `@REQ-…` and `@AC-…` tags that must exist in
`docs/traceability/requirements/`. The committed
[`traceability-matrix.md`](docs/traceability/traceability-matrix.md) shows the links and coverage
without results; each run writes `reports/traceability/` with that run's results. Why each
criterion is automated at its layer is in
[`automation-decisions.md`](docs/traceability/automation-decisions.md).

## Accessibility testing

`checkAccessibility(world, label)` runs axe-core against `accessibility.standard` (default
`wcag22aa`; also `wcag2a`, `wcag2aa`, `wcag21aa`) and fails on violations at or above
`accessibility.failOnImpact` (default `serious`). Each scan is attached as
`accessibility-scan.json` with rule IDs, impact, help links and element targets, never page HTML.
Keyboard scenarios tab through a page and assert each control's role, accessible name and
visible focus indicator. Automated checks find only part of the WCAG failures and do not replace
manual testing with keyboard and screen readers (ADR-015).

## Security testing

`@security` scenarios cover sign-out and session reuse, security response headers and
scope-based API authorization. They run only when the UI, API and identity hosts are all listed
in `security.authorizedHosts` (`SECURITY_AUTHORIZED_HOSTS`); otherwise they are skipped with the
reason attached. After every run the runner scans `reports/` for unredacted tokens, card numbers
and personal data, and for this run's actual credential values; findings fail the run and
print only file, line and kind.

## Flakiness

Every run appends each scenario's result to `reports/flakiness/history.jsonl` (last 30 runs, per
browser). `reports/flakiness/flakiness-report.md` lists scenarios that both passed and failed or
passed only on retry, with a flip rate, and separately those that failed every time. Fix the
cause; do not add waits or retries (RULE-006).

## Continuous integration

| Workflow           | Trigger                    | What it runs                                                                       |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------- |
| `pull-request.yml` | pull request, push to main | `npm run validate`; smoke, framework, API, UI and accessibility suites on Chromium |
| `regression.yml`   | weekdays 03:00 UTC, manual | Chromium, Firefox, WebKit × 3 shards, Pixel 7 and iPhone 15; merged Allure report  |
| `security.yml`     | pull request, push, weekly | `npm audit`, dependency review, CodeQL, gitleaks, `@security` scenarios            |

Actions are pinned to commit SHAs and the token is read-only. Pull-request runs use the local
reference app and need no secrets. For a remote environment set the repository variables
`TEST_ENV`, `UI_BASE_URL`, `API_BASE_URL`, `AUTH_BASE_URL` and `SECURITY_AUTHORIZED_HOSTS`, and the
secrets `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `API_CLIENT_ID`, `API_CLIENT_SECRET` (and
`API_KEY`) in the `regression` environment. Never write a secret value into a workflow file.
Reports are uploaded as artifacts kept for `REPORT_RETENTION_DAYS` days (default 7) and the
failure and flakiness summaries appear on the job page.

## Docker

```bash
docker compose -f docker/compose.yml run --rm tests npm run test:healthcare
docker compose -f docker/compose.yml run --rm -e BROWSER=firefox -e SHARD=1/2 tests
```

The image (`docker/Dockerfile`) uses the Playwright image matching the locked Playwright
version and runs as the non-root `pwuser`; reports are written to the mounted `reports/`
directory, which must be writable by the image's `pwuser`. Credentials are never built into the image.

## Cursor agents

`.cursor/agents/` holds sixteen project agents (architecture, requirements, scenarios,
automation selection, locators, page objects, API tests, test data, healthcare domain,
security, accessibility, flakiness, failure analysis, code review, documentation). Each defines
its input, output, restrictions, escalation rules, the files it may and must not modify and a
validation checklist, and must never fabricate requirements, locators, API responses or results.
Review agents are read-only. `npm run agents:lint` checks the definitions (ADR-017).

## Data protection

Only synthetic data is allowed. Logs and attachments are redacted automatically. Passing tests do
not establish HIPAA or any other regulatory compliance.
