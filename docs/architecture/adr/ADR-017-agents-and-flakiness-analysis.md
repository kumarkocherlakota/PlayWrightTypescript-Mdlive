# ADR-017: Cursor agents and flakiness analysis

- Status: Accepted
- Date: 2026-10-31
- Builds on: ADR-013, ADR-014

## Context

AI agents help write and review tests, but an agent that invents a locator, requirement or
result produces tests that look valid and are wrong. Flakiness is visible within one run only
when a retry passes; across runs it is not recorded at all.

## Decision

**Agents**

- Sixteen project agents in `.cursor/agents/<name>.md` (Cursor's project subagent format: YAML
  front matter `name`, `description`, `model`, `readonly`; the body is the prompt).
- Each has one responsibility and the sections Responsibility, Input contract, Output structure,
  Restrictions, Escalation rules, Files it may modify, Files it must not modify, Validation
  checklist and Never fabricate (requirements, locators, API responses, execution results, test
  results, domain rules). Missing evidence means stop and ask, never guess.
- Review and analysis agents (Architecture Review, Code Review, Flakiness Analysis) are
  `readonly: true` and modify nothing.
- `tools/agents` lints the definitions in `npm run validate`.

**Flakiness**

- After every run the runner appends each executed scenario's final status, attempt count and
  in-run flakiness to `reports/flakiness/history.jsonl`, keyed by location and browser (no step
  text or error messages). The last 30 runs are kept.
- `flakiness-report.{json,md}` lists unstable scenarios (both passed and failed across runs, or
  passed only on retry) with a flip rate, and lists scenarios that failed in every run
  separately: those are broken, not flaky.
- CI keeps the history per suite and browser in the Actions cache.

## Alternatives

| Option                                     | Why not chosen                                               |
| ------------------------------------------ | ------------------------------------------------------------ |
| One general-purpose agent                  | No clear contract, permissions or escalation                 |
| Allure history for flakiness               | Tied to report generation; not machine-readable for an agent |
| Quarantining flaky scenarios automatically | Hides defects; the cause must be fixed (RULE-006)            |

## Reason

Narrow agents with explicit file permissions are reviewable, and a lint keeps the contracts from
eroding. A small history file is enough to tell flaky from broken scenarios.

## Consequences

- Changing an agent's permissions is a reviewed change to its definition.
- Flakiness numbers are only as good as the history: a fresh cache starts from one run.

## Trade-offs

The agent lint checks structure, not the quality of an agent's advice; review still matters.
