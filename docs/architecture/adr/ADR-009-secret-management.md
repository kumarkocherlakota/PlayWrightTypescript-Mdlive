# ADR-009: Secret management

- Status: Accepted
- Date: 2026-10-31

## Context

Tests need credentials and tokens. Secrets leak most often through committed files, logs, report
attachments, traces and error messages.

## Decision

- Secrets are supplied only through environment variables (CI secrets, or a local git-ignored
  `.env`). `.env.example` documents names, never values.
- Only `src/core/config/environment-source.ts` reads `process.env` (ESLint rule).
- Secrets are **not** part of the configuration object. They are obtained from a
  `SecretProvider` and wrapped in a `Secret` value object: `toString()`, `toJSON()` and Node's
  `util.inspect` render `***`; only `reveal()` returns the value.
- Revealed values are registered with the `Redactor`, so they are masked even if they appear
  inside unrelated text.
- The `Redactor` masks sensitive keys and patterns in every log entry and attachment.
- Tracing is configured with `snapshots`/`screenshots` but traces are kept only on failure and
  retained briefly, because traces can contain typed values.
- CI: secret scanning (gitleaks) and dependency scanning (`npm audit`, Dependabot) in Phase 6.
- A `SecretProvider` interface allows a vault-backed adapter (Azure Key Vault, AWS Secrets Manager,
  HashiCorp Vault) without changing callers.

## Alternatives

| Option                                 | Why not chosen                             |
| -------------------------------------- | ------------------------------------------ |
| Encrypted secrets committed to repo    | Key distribution problem; still in history |
| Secrets in config JSON per environment | High leak risk                             |

## Reason

Least exposure, single access point, and defense in depth through redaction.

## Consequences

- Code that needs a secret must call `reveal()` explicitly, which is easy to review.

## Trade-offs

Slightly more ceremony when using credentials.
