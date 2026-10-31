# ADR-014: Healthcare reference use case and requirement traceability

- Status: Accepted
- Date: 2026-10-31
- Builds on: ADR-003, ADR-006, ADR-010, ADR-012, ADR-013

## Context

Phase 5 needs one complete healthcare use case: provider search, booking, dashboard verification
and cancellation, covered through the UI, the API and UI + API together, with positive, negative
and boundary scenarios. Each scenario must trace back to a requirement and forward to its
execution result. No live application or confirmed business rules are available (A-01, C-04 to
C-12), and no real patient data may be used (ADR-010).

## Decision

- **Synthetic reference portal.** The local reference app gains a patient portal (sign-in,
  provider search, booking, dashboard with cancellation) and provider, appointment and
  test-support APIs. All data is synthetic and in memory. Pages are static HTML with external
  module scripts, so the CSP still forbids inline script. The portal session is an opaque HttpOnly
  `SameSite=Strict` cookie. Cookie-authenticated writes from other sites are refused.
- **Policy comes from configuration, not from code.** Booking horizon, cancellation cutoff and
  maximum reason-for-visit length are read from `healthcare.appointmentPolicy`. Only `local` sets
  it (fixture values). The hooks pass the same values to the reference app, so the app and the
  scenarios cannot drift apart. An environment without the policy fails the affected scenarios
  with a `ConfigurationError` (`requireAppointmentPolicy`) instead of assuming values.
- **Three healthcare domains plus a shared kernel.**
  - `authentication`: sign-in page and workflow.
  - `providers`: directory and test-data clients, search page, provider card, builder, API and UI
    workflows.
  - `appointments`: client, booking and dashboard pages, appointment list, builder, validator,
    policy, and the API service, UI booking and UI dashboard workflows.
  - `shared-kernel`: `RequestOutcome`, the shared error contract and credential problems.
  - Domains import each other only through `index.ts` (RULE-018). `AppointmentBookingWorkflow`
    composes `ProviderSearchWorkflow`.
- **Scenario-owned test data.** Every scenario seeds its own provider through the test-support
  API. The provider's name carries the synthetic marker and a run- and worker-unique ID. Its
  removal is registered for cleanup immediately and also removes its times and appointments. All
  rows and searches are addressed by that name or by the appointment reference, never by
  position, so scenarios stay correct in parallel.
- **Session tags.**
  - `@ui`: browser only.
  - `@api`: API only.
  - `@integration`: both. The portal is driven and the result is prepared or verified through the
    API, for the same member.
  - `@api-setup`: UI scenarios that seed data through the API. This opens an API session but does
    not change the scenario's layer.
- **Times are compared as instants.** The portal renders times with `Intl` in the browser's time
  zone (`ui.timezoneId`) inside `<time datetime>`. Pages read the ISO value, never the localized
  text. Boundary times sit a few minutes either side of a limit, so the time a scenario takes
  cannot move them across it.
- **Traceability is generated from feature tags.**
  - The requirements catalogue (`docs/traceability/requirements/*.json`) holds synthetic reference
    requirements and acceptance criteria.
  - Scenarios carry `@REQ-…` and `@AC-…` tags. A criterion `AC-X-NNN.k` belongs to `REQ-X-NNN`.
  - `tools/traceability` parses the features (outlines expand to one row per Examples row) and
    validates every link.
  - It writes `docs/traceability/traceability-matrix.md` without results. It is committed and
    checked for drift by `npm run validate`.
  - After every run, the runner writes `reports/traceability/traceability-matrix.{md,json}` with
    that run's results. Results are joined by feature path and line from the messages stream.
  - Manual (`@manual`) and blocked (`@blocked`) scenarios are traced but never executed.
- **Privacy by design in the tests.** `reasonForVisit` and `symptom*` keys are redacted. Appointment
  lists omit the reason for visit, and the list contract rejects it. Validators never echo it in
  errors. Scenarios check that it is absent from lists and from the execution log. Credentials
  are revealed only to type them into the sign-in form.

## Alternatives

| Option                                                | Why not chosen                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Hard-code booking rules in steps or the reference app | Invents business rules; the app and the tests could disagree                    |
| Seed data through the UI                              | Slow, and couples every scenario to unrelated pages                             |
| One shared demo provider for all scenarios            | Parallel scenarios would book each other's times                                |
| Compare formatted dates in the UI                     | Depends on locale and time zone formatting; instants are unambiguous            |
| A spreadsheet traceability matrix maintained by hand  | Drifts from the features; cannot be checked in CI                               |
| Put execution results in the committed matrix         | A committed file would present a past run as current; results belong to a run   |
| Derive requirements from scenario names               | Names change freely; IDs in tags are stable and validated against the catalogue |

## Reason

Reading the policy from configuration keeps the framework honest about unknown rules. Seeding
per scenario, with immediate cleanup, makes the scenarios independent and safe to run in
parallel. When traceability is generated from tags and validated in `validate`, it cannot fall
out of date. Keeping results in run reports keeps defined scenarios apart from executed ones.

## Consequences

- A real application needs confirmed requirements in the catalogue, an appointment policy per
  environment, and a seeding interface (C-19). Without one, domains seed through the UI or use
  pre-provisioned data, and cleanup cancels instead of deleting (C-14).
- New healthcare scenarios must carry an `@AC` tag and the matching `@REQ` tag, or
  `traceability:check` fails.
- The demo providers, fixture specialties and portal wording describe the reference app only.

## Trade-offs

- All scenarios share one synthetic member, so the dashboard holds rows from parallel scenarios.
  Rows are found by reference. An "empty dashboard" state cannot be asserted reliably and is not
  automated.
- The cross-member privacy check needs a second account and is manual (C-12). The automated check
  uses an unknown appointment ID, which is weaker.
- Playwright traces of signed-in scenarios contain the session cookie and typed credentials. They
  stay local and are referenced by path only (ADR-013).
