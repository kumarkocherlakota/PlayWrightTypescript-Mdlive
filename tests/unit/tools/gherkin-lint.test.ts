import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { lintFeature } from '../../../tools/gherkin-lint/lint-feature';
import { loadPolicy } from '../../../tools/gherkin-lint/lint-policy';

const policy = loadPolicy(path.resolve(__dirname, '../../../config/gherkin-lint.json'));

function rules(source: string): string[] {
  return lintFeature(source, 'test.feature', policy).map((issue) => issue.rule);
}

const VALID = `
@ui
Feature: Appointments
  @positive @REQ-APPT-001
  Scenario: Member books an appointment
    When the member submits the appointment request
    Then the appointment is confirmed
`;

describe('lintFeature', () => {
  it('accepts a well-formed, tagged, business-language feature', () => {
    assert.deepEqual(rules(VALID), []);
  });

  it('reports invalid Gherkin with its location', () => {
    const issue = lintFeature(
      'Feature: x\n  Scenario: y\n    Given a\n  Nonsense line',
      't',
      policy,
    )[0];
    assert.ok(issue);
    assert.equal(issue.rule, 'GL001');
    assert.ok(issue.line > 1);
  });

  it('requires type and intent tags but exempts framework scenarios from type tags', () => {
    const untagged = `Feature: F\n  Scenario: S\n    Then the result is shown\n`;
    assert.deepEqual(rules(untagged), ['GL003', 'GL004']);
    const framework = `@framework\nFeature: F\n  @positive\n  Scenario: S\n    Then ok\n`;
    assert.deepEqual(rules(framework), []);
  });

  it('accepts tags inherited from Examples blocks', () => {
    const source = `@api\nFeature: F\n  Scenario Outline: S <n>\n    Then value <n> is stored\n\n    @boundary\n    Examples:\n      | n |\n      | 1 |\n`;
    assert.deepEqual(rules(source), []);
  });

  it('rejects unknown tags', () => {
    assert.deepEqual(rules(VALID.replace('@positive', '@positive @flaky')), ['GL005']);
  });

  it('rejects selectors, XPath, test ids and fixed waits in steps', () => {
    const steps = [
      'When I click "#submit-button"',
      'When the user presses ".btn-primary" now',
      'When the user follows "//div[@id=x]"',
      'When the member uses data-testid "save"',
      'When the member waits 5 seconds',
    ];
    for (const step of steps) {
      const source = VALID.replace('When the member submits the appointment request', step);
      assert.ok(rules(source).includes('GL006'), `expected GL006 for: ${step}`);
    }
  });

  it('warns about UI-mechanics wording without failing', () => {
    const source = VALID.replace('When the member submits', 'When I click to submit');
    const issues = lintFeature(source, 't', policy);
    assert.deepEqual(
      issues.map((issue) => [issue.rule, issue.severity]),
      [['GL007', 'warning']],
    );
  });

  it('reports duplicate scenario names and empty scenarios', () => {
    const source = `@ui\nFeature: F\n  @positive\n  Scenario: Same\n    Then a\n  @positive\n  Scenario: Same\n`;
    assert.deepEqual(rules(source).sort(), ['GL008', 'GL010']);
  });

  it('reports placeholders without Examples or without a matching column', () => {
    const noExamples = `@ui\nFeature: F\n  @positive\n  Scenario Outline: S\n    Then value <n> is stored\n`;
    assert.ok(rules(noExamples).includes('GL009'));
    const wrongColumn = `@ui\nFeature: F\n  @positive\n  Scenario Outline: S\n    Then value <n> is stored\n    Examples:\n      | m |\n      | 1 |\n`;
    assert.deepEqual(rules(wrongColumn), ['GL011']);
  });
});
