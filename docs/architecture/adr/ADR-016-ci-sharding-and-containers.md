# ADR-016: CI/CD, sharding, cross-browser runs and containers

- Status: Accepted
- Date: 2026-10-31
- Builds on: ADR-008, ADR-009, ADR-013

## Context

The suites must run on every pull request, on a schedule across browsers and viewports, and in a
reproducible container, without secrets in workflow files and with reports kept only as long as
needed. ADR-008 left sharding open.

## Decision

- **Sharding:** `SHARD=<index>/<total>` maps to Cucumber's native `shard` option in
  `cucumber.mjs`, which deals scenarios round-robin, so each scenario runs in exactly one shard.
  An index outside `1..total` stops the run (Cucumber would otherwise run nothing).
- **Workflows** (`.github/workflows`):
  - `pull-request.yml`: `npm run validate`, then smoke, framework, API, UI and accessibility
    suites on Chromium against the local reference app.
  - `regression.yml` (weekdays and on demand): every runnable scenario on Chromium, Firefox and
    WebKit × three shards, plus Pixel 7 and iPhone 15 viewports; one merged Allure report.
  - `security.yml`: `npm audit`, dependency review (pull requests), CodeQL, gitleaks and the
    `@security` scenarios.
- **Hardening:** every action is pinned to a commit SHA with the version in a comment, the
  default token is `contents: read`, checkout does not persist credentials, and `npm ci`
  installs the locked tree. Caches hold only npm and Playwright downloads and the flakiness
  history.
- **Secrets:** only `${{ secrets.* }}`, scoped to the `regression` GitHub environment; GitHub
  masks them. With `TEST_ENV=local` no secrets are needed: the runner generates throwaway
  synthetic credentials.
- **Reports:** published as artifacts and job summaries (failure analysis, flakiness), with
  retention `vars.REPORT_RETENTION_DAYS` (default 7). Allure is not published to a public site.
- **Retries** stay CI-only (ADR-008). Time zone and locale come from `TIMEZONE` / `LOCALE`.
- **Docker:** `docker/Dockerfile` builds on `mcr.microsoft.com/playwright` with the same version
  as the lockfile, installs with `npm ci` and runs as the non-root `pwuser`. No credentials are
  built in; `docker/compose.yml` passes them from the environment at run time.

## Alternatives

| Option                                | Why not chosen                                                        |
| ------------------------------------- | --------------------------------------------------------------------- |
| Split shards by feature paths or tags | Uneven shards; every new feature needs a CI change                    |
| Custom shard filter in the runner     | Cucumber 13 ships the same round-robin split natively                 |
| Actions referenced by tag             | A moved tag can change the code that runs with the repository token   |
| Publishing Allure to GitHub Pages     | Makes run evidence public; reports may describe the system under test |

## Reason

Native sharding and pinned, least-privilege workflows keep CI simple and safe; the container
gives the same browser builds locally and in CI.

## Consequences

- Shards must be merged for one report; the `report` job does this from the Allure results.
- Updating Playwright means updating the Docker base image tag as well.
- CodeQL on private repositories needs GitHub Advanced Security; gitleaks needs a license for
  organization-owned repositories (`GITLEAKS_LICENSE`).

## Trade-offs

More CI jobs (eleven regression entries) in exchange for shorter wall-clock time and
per-browser results.
