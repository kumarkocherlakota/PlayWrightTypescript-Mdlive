# Universal Playwright Automation Framework

Playwright + TypeScript + Cucumber BDD framework for UI, API and UI+API testing, with a healthcare
reference domain (provider search and appointment booking).

> **Status: Phases 1–3 complete** (foundation, core UI framework, API framework). Allure (Phase 4),
> the healthcare use case (Phase 5) and CI/agents (Phase 6) are planned in
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
| `PARALLEL_WORKERS`, `CI`, `RETRIES`, `TAGS`        | Runner switches (retries apply only when `CI=true`)                           |

See [`.env.example`](.env.example) for the full list.

## Commands

| Command                                                           | What it does                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run validate`                                                | Format check, lint, type check, architecture boundaries, unit tests, BDD dry run    |
| `npm run test:framework`                                          | Framework self-checks (UI and API) against the local synthetic reference app        |
| `npm test`                                                        | All non-`@wip` scenarios for `TEST_ENV` (default `qa`)                              |
| `npm run test:smoke` / `test:regression` / `test:ui` / `test:api` | Tag-based profiles                                                                  |
| `npm run test:unit`                                               | Unit tests for framework code (`node:test`); UI-layer tests need Chromium installed |
| `npm run bdd:check`                                               | Fails on undefined or ambiguous steps                                               |
| `npm run bdd:usage`                                               | Lists step definitions and unused steps                                             |
| `npm run bdd:unused`                                              | Fails when a step definition is not used by any feature                             |
| `npm run bdd:lint`                                                | Gherkin lint: tags, selectors/waits in steps, duplicates, broken outlines           |
| `npm run arch:check`                                              | Layer, domain-boundary and circular-dependency rules                                |
| `npm run reference-app`                                           | Starts the local synthetic reference app at `http://localhost:4000/gallery`         |

Examples:

```bash
PARALLEL_WORKERS=4 npm run test:framework
BROWSER=firefox npm run test:framework
npx cucumber-js --profile framework --tags "@security"
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

All output goes to `reports/` (git-ignored):

- `reports/cucumber/cucumber-report.html` and `.json`
- `reports/junit/junit.xml`
- `reports/logs/worker-<id>.jsonl`: structured, redacted logs per worker
- `reports/screenshots`, `reports/traces`, `reports/videos`: kept according to the artifact policy (default: on failure only)

Open a trace with `npx playwright show-trace reports/traces/<file>.zip`.

## Project layout

```text
features/            Gherkin specifications
src/bdd/             World, hooks, steps, parameter types
src/domains/         Business domains (component-gallery: UI template, inventory: API template)
src/interaction/ui/  BasePage, BaseComponent and generic components
src/interaction/api/ ApiSession, HttpClient, auth strategies, SchemaValidator
src/core/            Config, errors, logging, security, artifacts, browser lifecycle, polling, test data
reference-app/       Local synthetic app and API used by self-tests (no real data)
tools/               Gherkin linter, unused-step check, local runner
config/environments/ Non-secret environment settings
docs/architecture/   Architecture, ADRs, clarification list
.cursor/rules/       Governance rules RULE-001 … RULE-018
tests/unit/          Unit tests for framework code
```

## Data protection

Only synthetic data is allowed. Logs and attachments are redacted automatically. Passing tests do
not establish HIPAA or any other regulatory compliance.
