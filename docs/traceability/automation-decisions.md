# UI and API automation decisions

Why each acceptance criterion of the healthcare reference use case is automated at the layer it
is. The general rule: **verify rules at the API, verify what the member sees in the UI, and use
UI + API where the two must agree.** The mapping of criteria to scenarios is in
[`traceability-matrix.md`](traceability-matrix.md). The requirements are synthetic reference
requirements (see the catalogue).

## Layer per criterion

| Criterion     | Layer                         | Why this layer                                                                                                                                     |
| ------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-AUTH-001.1 | UI                            | Signing in is a browser journey that ends on the dashboard                                                                                         |
| AC-AUTH-001.2 | UI                            | The member-facing message is the requirement; the generic wording prevents account enumeration                                                     |
| AC-AUTH-001.3 | UI                            | Redirects of protected pages happen in the browser; one Examples row per page                                                                      |
| AC-AUTH-001.4 | UI                            | Cookie attributes and script access are browser properties; the cookie value is never read into test state                                         |
| AC-PROV-001.1 | UI (API setup)                | What the member sees on a result card; the provider is seeded through the API                                                                      |
| AC-PROV-001.2 | API                           | A filtering rule; the API checks every returned provider quickly and exactly                                                                       |
| AC-PROV-001.3 | API                           | Input validation of the API contract                                                                                                               |
| AC-PROV-001.4 | UI                            | The empty-state announcement is UI behaviour                                                                                                       |
| AC-PROV-001.5 | API and UI (API setup)        | The API reports availability; the UI must not offer the booked time. Both are cheap and catch different defects                                    |
| AC-PROV-001.6 | API                           | Authentication of the API, independent of the portal                                                                                               |
| AC-APPT-001.1 | UI (API setup) and API        | The UI covers the member journey and confirmation; the API checks that exactly what was requested is stored                                        |
| AC-APPT-001.2 | API and UI + API              | The API checks the conflict rule (409); UI + API checks that the member is told when a time is taken between choosing and confirming               |
| AC-APPT-001.3 | API (all bounds) and UI       | All four length bounds at the API; empty and over-length in the UI to prove the field error is shown and associated with the field (accessibility) |
| AC-APPT-001.4 | API                           | A time-based rule; exact boundary placement is only practical through the API                                                                      |
| AC-APPT-001.5 | API                           | A past time cannot be offered in the UI, so only the API can attempt it                                                                            |
| AC-APPT-002.1 | UI + API                      | The dashboard must show what the service recorded: booked through the API, verified in the UI, time compared as the same instant                   |
| AC-APPT-002.2 | UI + API                      | The reverse direction: booked in the UI, verified through the API including the reason for visit                                                   |
| AC-APPT-003.1 | UI + API                      | Cancelling is a UI journey; the API confirms the service state changed                                                                             |
| AC-APPT-003.2 | API (both sides) and UI + API | The cutoff rule at the API on both sides of the limit; the UI explains a refusal                                                                   |
| AC-APPT-003.3 | API                           | Repeating a cancellation is not possible in the UI (no cancel option), so only the API can attempt it                                              |
| AC-APPT-003.4 | UI + API                      | Dialog focus and labelling are UI accessibility concerns; the appointment is seeded through the API                                                |
| AC-APPT-003.5 | UI + API                      | A change made outside the portal must appear on the dashboard                                                                                      |
| AC-APPT-004.1 | API                           | Minimum necessary is a property of the API response; the contract also rejects the field in lists                                                  |
| AC-APPT-004.2 | API (partly) and manual       | Automated: an unknown ID returns 404. Manual: another member's appointment, which needs a second account (C-12)                                    |
| AC-APPT-004.3 | API                           | The execution log is a framework artifact; checked after a booking with a distinctive synthetic reason                                             |
| AC-APPT-005.1 | Blocked                       | The retention period is not defined (C-11); no behaviour can be asserted                                                                           |

## Not automated, and why

- **Another member's appointment (AC-APPT-004.2, manual).** It needs a second synthetic member
  account and the role catalogue (C-12). The scenario is written and traced as `@manual`.
- **Retention (AC-APPT-005.1, blocked).** It is blocked until the retention period is defined
  (C-11). It is traced as `@blocked` and never executed.
- **Session timeout.** The value is not confirmed (C-03). The reference app expires portal
  sessions after 30 minutes. Waiting for that in a test would be a fixed wait (RULE-006).
- **Duplicate appointments across providers and booking limits per member.** These are not
  defined (C-05). Only "the same time cannot be booked twice" is automated.
- **Dependents and age rules.** Not defined (C-07).
- **Display time zone.** It is open whether times are shown in the member's or the clinic's time
  zone (C-20). Scenarios compare instants, not formatted text.
- **Audit logging.** The reference app has no audit trail. Audit requirements are part of C-11.

## Test data and isolation

- Every scenario seeds its own provider through the test-support API, with a unique, marked name.
  Its removal is registered for cleanup immediately, and removing it also deletes its times and
  appointments.
- All scenarios use the same synthetic member (generated for local runs). Dashboard rows are
  found by appointment reference, never by position.
- Booking boundaries sit 5 minutes either side of the configured limit, so they are stable for
  any run length below that margin.

## What these results mean

All scenarios run against the local synthetic reference app. A passing run shows that the
framework and the reference app behave as specified. It says nothing about a real application,
and it does not establish HIPAA, GDPR or any other regulatory compliance.
