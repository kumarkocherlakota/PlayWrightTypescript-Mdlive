# Universal Playwright Automation Framework

Playwright + TypeScript + Cucumber BDD framework for UI, API and UI+API testing, with a healthcare
reference domain (provider search and appointment booking).

> **Status: Phases 1–2 complete** (foundation and core UI framework). The API framework (Phase 3),
> Allure (Phase 4), the healthcare use case (Phase 5) and CI/agents (Phase 6) are planned in
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

| Variable                                           | Purpose                                             |
| -------------------------------------------------- | --------------------------------------------------- |
| `TEST_ENV`                                         | `local`, `dev`, `qa` (default) or `staging`         |
| `UI_BASE_URL`, `API_BASE_URL`, `AUTH_BASE_URL`     | Service endpoints (required for dev/qa/staging)     |
| `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`            | Synthetic test user, read as masked `Secret` values |
| `BROWSER`, `BROWSER_CHANNEL`, `DEVICE`, `HEADLESS` | Browser selection                                   |
| `PARALLEL_WORKERS`, `CI`, `RETRIES`, `TAGS`        | Runner switches (retries apply only when `CI=true`) |

See [`.env.example`](.env.example) for the full list.

## Commands

| Command                                                           | What it does                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run validate`                                                | Format check, lint, type check, architecture boundaries, unit tests, BDD dry run    |
| `npm run test:framework`                                          | Framework self-check scenarios against the `local` environment                      |
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
src/domains/         Business domains (component-gallery is the self-test domain and template)
src/interaction/ui/  BasePage, BaseComponent and generic components
src/core/            Config, errors, logging, security, artifacts, browser lifecycle, polling
reference-app/       Local synthetic app used by self-tests (no real data)
tools/               Gherkin linter and unused-step check
config/environments/ Non-secret environment settings
docs/architecture/   Architecture, ADRs, clarification list
.cursor/rules/       Governance rules RULE-001 … RULE-018
tests/unit/          Unit tests for framework code
```

## Data protection

Only synthetic data is allowed. Logs and attachments are redacted automatically. Passing tests do
not establish HIPAA or any other regulatory compliance.
