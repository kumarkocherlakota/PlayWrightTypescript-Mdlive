# ADR-012: API interaction, authentication and test-data lifecycle

- Status: Accepted
- Date: 2026-10-31

## Context

Phase 3 introduces the API layer. API tests must authenticate without exposing credentials,
verify response contracts, stay independent while running in parallel, and leave no data behind.
No live API is available while the framework is built (A-01), so the layer also needs a local
target that behaves like a real OAuth-protected service.

## Decision

- **One `ApiSession` per scenario** (`src/interaction/api`), opened for `@api` and `@integration`
  scenarios. It owns a Playwright `APIRequestContext` (isolated cookies), its own token cache, and
  a summary of every exchange. API-only scenarios never start a browser (ADR-004).
- **`HttpClient` adds only what raw requests lack:** base-URL joining that keeps path prefixes
  (`new URL('/x', base)` would drop them), authentication through a strategy, a correlation-ID
  header (`api.correlationHeader`), expected-status checks that throw `ApiRequestError`, timing with
  slow-response warnings (`api.responseTimeThresholdMs`), and redacted debug logging. Requests
  marked `sensitive` never have their bodies logged. Redirects are not followed.
- **Authentication is a port** (`AuthStrategy`) with adapters selected by `auth.apiMethod`:
  OAuth 2.0 password grant, OAuth 2.0 client-credentials grant, API key, or none. Secrets are read
  from the `SecretProvider` on first use only, so scenarios that never authenticate never require
  them. Tokens are cached per session, renewed 30 seconds before expiry, shared between concurrent
  requests, and registered with the scenario `Redactor` the moment they are issued.
- **Contracts are JSON Schemas validated by Ajv**, typed with `JSONSchemaType<T>` so TypeScript
  rejects a schema that does not describe its model. Violations report locations and rules, never
  values. Zod stays the tool for the framework's own configuration; Ajv is used for API contracts
  because real contracts arrive as OpenAPI/JSON Schema (and FHIR profiles), which Zod cannot read.
- **Rejections are values for negative tests.** Domain clients expose `attempt…` methods that
  return `RequestOutcome<T>` (accepted value, or status, error code and invalid fields) instead of
  throwing; regular methods enforce the expected status.
- **Business validation lives in the domain** (`src/domains/<domain>/validators`), separate from
  contract validation (e.g. "stored exactly as requested, marked synthetic, created just now").
- **Test-data lifecycle (ADR-006):**
  - `UniqueIdGenerator` (one per worker) builds `<marker><LABEL>-<run hash>-w<worker>-<seq>`.
  - Builders produce valid synthetic data by default; tests change only what they are about.
  - Workflows register an undo action in the scenario's `CleanupRegistry` immediately after
    creating anything. The `After` hook runs cleanup first (it needs the API session), then API
    and UI finalization; every teardown step runs even when an earlier one fails, failures are
    logged at error level, and any cleanup failure fails the scenario with a `TestDataError`.
- **Local synthetic identity provider and API** in `reference-app/`: an OAuth 2.0 token endpoint
  issuing HS256 JWTs (random key per process) and an inventory API with scope checks. It accepts
  exactly the credentials configured for the run (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`,
  `API_CLIENT_ID`/`API_CLIENT_SECRET`, `API_KEY`), so no account exists in source control. For
  `local` runs, `tools/run/run-cucumber.ts` generates throwaway values in memory when none are set.

## Alternatives

| Option                                       | Why not chosen                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| Zod for API contracts                        | Cannot consume OpenAPI/JSON Schema contracts supplied by API teams        |
| One API context per worker                   | Leaks cookies and tokens between scenarios                                |
| Throwing on every non-2xx response           | Negative tests would rely on catching errors, which hides real failures   |
| Retrying 401 with a fresh token              | Can mask authentication defects; tokens are renewed before expiry instead |
| Cleanup in `AfterAll` or a nightly purge job | Data outlives failing scenarios and collides with parallel runs           |
| Fixed local test account committed to source | Violates RULE-007 and would be flagged by secret scanning                 |

## Reason

A small, explicit HTTP layer with pluggable authentication keeps domain clients readable, makes
every credential use reviewable, and keeps scenarios independent and free of leftover data.

## Consequences

- New API capability is added as a domain client method plus schema, never in `HttpClient`.
- API scenarios against `local` need no setup; other environments need the secrets of their
  configured `auth.apiMethod`.
- Teardown failures are visible as scenario failures and in the scenario log.

## Trade-offs

Schemas are written as TypeScript objects with mirror contract types (Ajv's typing does not accept
readonly members). When an API team supplies an OpenAPI document, schemas should be generated from
it instead of written by hand.
