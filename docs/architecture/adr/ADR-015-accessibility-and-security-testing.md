# ADR-015: Accessibility and security testing

- Status: Accepted
- Date: 2026-10-31
- Builds on: ADR-009, ADR-010, ADR-013, ADR-014

## Context

Phase 6 adds automated accessibility checks against a configurable WCAG target and security
tests for authentication, authorization and sessions. Both must report evidence without leaking
credentials or personal data, and security tests must never be pointed at a host nobody
authorized. Automated accessibility checks find only part of the WCAG failures.

## Decision

**Accessibility**

- `AccessibilityScanner` (`src/interaction/ui/accessibility`) runs axe-core through
  `@axe-core/playwright` with the cumulative tags of `accessibility.standard` (`wcag2a`,
  `wcag2aa`, `wcag21aa`, `wcag22aa`; default `wcag22aa`). Violations at or above
  `accessibility.failOnImpact` (default `serious`) fail the step; an unknown impact counts as
  blocking. Lower-impact violations and "needs review" results are reported, not failed.
- Every scan is attached to the scenario as `accessibility-scan.json` through the `Redactor`.
  The result keeps rule IDs, impact, help URL and at most five CSS targets per rule, never node
  HTML, so page content (which could include personal data) does not reach reports.
- `KeyboardNavigation` presses Tab and records each focus stop's role, accessible name (from the
  accessibility tree) and whether a focus indicator (outline or box-shadow) is visible.
  Scenarios assert the expected order in a data table.
- Covered by automation: keyboard navigation, focus order and visibility, accessible names,
  form labels, error-message association, ARIA validity, headings and colour contrast (axe
  rules), and dialog focus (the cancellation dialog takes keyboard focus). Screen-reader
  announcements need a person and are `@manual` (AC-ACCESS-001.3). The accessibility feature and every scan result say
  that automated checks do not replace manual testing.

**Security**

- A `Before` hook for `@security` compares the UI, API and identity base URLs with
  `security.authorizedHosts` (`SECURITY_AUTHORIZED_HOSTS`; exact names or `*.domain`). If any
  host is missing, the scenario is skipped and the reason is attached. The local reference app
  authorizes only `localhost` and `127.0.0.1`.
- Scenarios cover sign-out (the session cookie is cleared and the old session is refused, without
  reading the cookie value), security response headers (framing, inline script, content-type
  sniffing, referrer; `assessSecurityHeaders` in `src/core/security`), and scope-based
  authorization of a service client (OAuth client credentials) against member-only endpoints.
  Session timeout is `@blocked` until the duration is confirmed (C-03).
- After every run the runner scans `reports/` for text the `Redactor` should have masked and for
  the literal values of this run's credentials (`tools/security`). Findings print file, line and
  kind only, and fail an otherwise passing run. `npm run security:scan-reports` runs the same
  scan standalone (patterns only).

## Alternatives

| Option                                    | Why not chosen                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Pa11y or Lighthouse                       | A second browser driver; axe-core runs inside the Playwright page already  |
| Fail on every axe violation               | Minor findings would block delivery; the threshold is configurable         |
| Attach axe's full result (with node HTML) | Copies page content, which may include personal data, into reports         |
| DAST scanner (e.g. ZAP) in the suite      | Active scanning needs explicit authorization per environment; out of scope |

## Reason

axe-core is the de facto rule engine, maintained against current WCAG versions, and the
threshold and standard keep the decision about what blocks a release in configuration. The
host guard and the post-run leak scan turn two of the security rules into checks.

## Consequences

- Passing accessibility or security scenarios do not establish WCAG conformance, HIPAA, GDPR or
  any other compliance; reports and docs never claim it.
- A new page should get an accessibility scan scenario (Accessibility agent).
- Remote environments must list their hosts in `SECURITY_AUTHORIZED_HOSTS` before `@security`
  scenarios run there.

## Trade-offs

Pattern-based leak scanning can miss data that matches no pattern and occasionally flags
harmless text; known secret values are matched exactly, which catches the most damaging leaks.
