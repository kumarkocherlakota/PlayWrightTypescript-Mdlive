import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compile } from '@cucumber/gherkin';
import { IdGenerator, TestStepResultStatus, type Envelope } from '@cucumber/messages';
import { buildMatrix } from '../../../tools/traceability/build-matrix';
import { collectScenarios, parseFeature } from '../../../tools/traceability/collect-scenarios';
import { resultsFromRun } from '../../../tools/traceability/execution-results';
import { renderMatrix } from '../../../tools/traceability/render-matrix';
import {
  parseCatalogue,
  requirementIdOf,
  type RequirementsCatalogue,
} from '../../../tools/traceability/requirements-catalogue';

const URI = 'features/example.feature';

const FEATURE = `@healthcare @api @REQ-APPT-001
Feature: Booking

  @positive @AC-APPT-001.1
  Scenario: Books a time
    When it books

  @boundary @AC-APPT-001.2
  Scenario Outline: Length <length>
    When it books with <length>

    Examples:
      | length |
      | 0      |
      | 201    |

  @manual @security @AC-APPT-001.2
  Scenario: Checked by hand
    When someone checks

  @integration @negative @AC-APPT-001.3
  Scenario: Unknown criterion
    When it books
`;

const CATALOGUE: RequirementsCatalogue = {
  description: 'Synthetic catalogue for unit tests.',
  requirements: [
    {
      id: 'REQ-APPT-001',
      title: 'Booking',
      statement: 'Members book times.',
      acceptanceCriteria: [
        { id: 'AC-APPT-001.1', text: 'Books.' },
        { id: 'AC-APPT-001.2', text: 'Length limits.' },
      ],
    },
    {
      id: 'REQ-APPT-002',
      title: 'Dashboard',
      statement: 'Members see appointments.',
      acceptanceCriteria: [{ id: 'AC-APPT-002.1', text: 'Shown.' }],
    },
  ],
};

describe('collectScenarios', () => {
  const scenarios = collectScenarios(FEATURE, URI);

  it('expands outlines and locates each pickle at its scenario or Examples row', () => {
    assert.deepEqual(
      scenarios.map((scenario) => scenario.location),
      [`${URI}:5`, `${URI}:14`, `${URI}:15`, `${URI}:18`, `${URI}:22`],
    );
  });

  it('inherits feature tags and derives layer, intent, mode and links', () => {
    const [booking, , , manual, integration] = scenarios;
    assert.deepEqual(
      {
        requirementIds: booking?.requirementIds,
        criterionIds: booking?.criterionIds,
        layer: booking?.layer,
        intents: booking?.intents,
        mode: booking?.mode,
      },
      {
        requirementIds: ['REQ-APPT-001'],
        criterionIds: ['AC-APPT-001.1'],
        layer: 'API',
        intents: ['positive'],
        mode: 'automated',
      },
    );
    assert.equal(manual?.mode, 'manual');
    assert.equal(integration?.layer, 'UI + API');
  });
});

describe('buildMatrix', () => {
  const matrix = buildMatrix(CATALOGUE, collectScenarios(FEATURE, URI));

  it('reports links that do not resolve to the catalogue', () => {
    assert.deepEqual(matrix.issues, [
      `${URI}:22 "Unknown criterion" references unknown acceptance criterion AC-APPT-001.3`,
    ]);
  });

  it('flags traced scenarios without criteria and criteria without their requirement tag', () => {
    const untagged = `@healthcare @api\nFeature: F\n\n  @positive @AC-APPT-002.1\n  Scenario: S\n    When x\n\n  @positive\n  Scenario: T\n    When y\n`;
    const { issues } = buildMatrix(CATALOGUE, collectScenarios(untagged, URI));
    assert.deepEqual(issues, [
      `${URI}:5 "S" covers AC-APPT-002.1 but is not tagged @REQ-APPT-002`,
      `${URI}:9 "T" is tagged @healthcare but has no @AC tag`,
    ]);
  });

  it('lists uncovered criteria and summarizes coverage', () => {
    const uncovered = matrix.rows.filter((row) => row.scenario === undefined);
    assert.deepEqual(
      uncovered.map((row) => row.criterionId),
      ['AC-APPT-002.1'],
    );
    assert.equal(matrix.criterionCoverage.get('AC-APPT-001.2'), 'automated');
    assert.deepEqual(matrix.coverage.requirements, {
      total: 2,
      automated: 1,
      'manual only': 0,
      'blocked only': 0,
      'not covered': 1,
    });
    assert.deepEqual(matrix.coverage.scenarios.byMode, { automated: 4, manual: 1, blocked: 0 });
    assert.equal(matrix.coverage.scenarios.byLayer['UI + API'], 1);
    assert.equal(matrix.coverage.execution, undefined);
  });

  it('ignores untraced framework scenarios', () => {
    const framework = `@framework @api\nFeature: F\n\n  Scenario: S\n    When x\n`;
    assert.equal(
      buildMatrix(CATALOGUE, collectScenarios(framework, URI)).coverage.scenarios.total,
      0,
    );
  });
});

/** A messages stream for FEATURE where "Books a time" fails once, then passes on retry. */
function recordedRun(): Envelope[] {
  const newId = IdGenerator.uuid();
  const document = parseFeature(FEATURE, URI);
  const pickles = compile(document, URI, newId);
  const envelopes: Envelope[] = [
    { gherkinDocument: document },
    ...pickles.map((pickle) => ({ pickle })),
    { testRunStarted: { timestamp: { seconds: 1_767_268_800, nanos: 0 } } },
  ];
  const first = pickles[0];
  if (first === undefined) {
    throw new Error('Feature has no pickles.');
  }
  const stepId = 'step-1';
  envelopes.push({
    testCase: {
      id: 'case-1',
      pickleId: first.id,
      testSteps: [{ id: stepId, pickleStepId: first.steps[0]?.id ?? '' }],
    },
  });
  for (const [attempt, status] of [
    TestStepResultStatus.FAILED,
    TestStepResultStatus.PASSED,
  ].entries()) {
    const startedId = `started-${attempt}`;
    const timestamp = { seconds: 0, nanos: 0 };
    envelopes.push(
      { testCaseStarted: { id: startedId, testCaseId: 'case-1', attempt, timestamp } },
      {
        testStepFinished: {
          testCaseStartedId: startedId,
          testStepId: stepId,
          testStepResult: { status, duration: { seconds: 0, nanos: 0 } },
          timestamp,
        },
      },
      {
        testCaseFinished: { testCaseStartedId: startedId, willBeRetried: attempt === 0, timestamp },
      },
    );
  }
  return envelopes;
}

describe('resultsFromRun', () => {
  it('joins results to scenarios by location and detects flaky retries', () => {
    const run = resultsFromRun(recordedRun());
    assert.equal(run.startedAt, '2026-01-01T12:00:00.000Z');
    assert.deepEqual(run.byLocation.get(`${URI}:5`), {
      status: 'passed',
      attempts: 2,
      flaky: true,
    });
    assert.equal(run.byLocation.has(`${URI}:14`), false);

    const matrix = buildMatrix(CATALOGUE, collectScenarios(FEATURE, URI), run);
    assert.deepEqual(matrix.coverage.execution, {
      passed: 1,
      failed: 0,
      skipped: 0,
      flaky: 1,
      notRun: 3,
    });
  });
});

describe('renderMatrix', () => {
  const scenarios = collectScenarios(FEATURE, URI);

  it('never presents results in the committed matrix', () => {
    const markdown = renderMatrix(
      buildMatrix(CATALOGUE, scenarios, resultsFromRun(recordedRun())),
      {
        withResults: false,
        catalogueFile: 'catalogue.json',
      },
    );
    assert.ok(!markdown.includes('Passed'));
    assert.ok(markdown.includes('See run report'));
    assert.ok(markdown.includes('Manual (not automated)'));
    assert.ok(markdown.includes('**Not covered**'));
  });

  it('shows run results, flakiness and scenarios that did not run', () => {
    const markdown = renderMatrix(
      buildMatrix(CATALOGUE, scenarios, resultsFromRun(recordedRun())),
      {
        withResults: true,
        catalogueFile: 'catalogue.json',
      },
    );
    assert.ok(markdown.includes('Passed (flaky) after 2 attempts'));
    assert.ok(markdown.includes('| Not run |'));
    assert.ok(markdown.includes('2026-01-01T12:00:00.000Z'));
  });
});

describe('parseCatalogue', () => {
  it('derives the requirement of a criterion', () => {
    assert.equal(requirementIdOf('AC-APPT-003.12'), 'REQ-APPT-003');
  });

  it('rejects duplicate IDs and criteria filed under another requirement', () => {
    const broken = structuredClone(CATALOGUE) as {
      requirements: { acceptanceCriteria: { id: string; text: string }[] }[];
    };
    const [first, second] = broken.requirements;
    if (first === undefined || second === undefined) {
      throw new Error('Catalogue fixture changed.');
    }
    first.acceptanceCriteria.push({ id: 'AC-APPT-001.1', text: 'Again.' });
    second.acceptanceCriteria.push({ id: 'AC-APPT-001.9', text: 'Misfiled.' });
    assert.throws(
      () => parseCatalogue(broken),
      /AC-APPT-001\.1 is defined more than once; AC-APPT-001\.9 is listed under REQ-APPT-002/,
    );
  });
});
