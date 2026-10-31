import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { Redactor } from '@core/security';
import {
  allureCategoryRules,
  classifyReportedFailure,
  evidenceFromReportedError,
  type AllureMatchingData,
} from '../../../tools/failure-analysis/allure-categories';
import { analyzeRun, summarizeMessage } from '../../../tools/failure-analysis/analyze-run';
import { markFlakyRetries } from '../../../tools/failure-analysis/mark-allure-flaky';
import { renderMarkdown } from '../../../tools/failure-analysis/render-markdown';
import { collectAttempts, parseEnvelopes } from '../../../tools/failure-analysis/scenario-attempts';

interface AttemptSpec {
  readonly status: 'PASSED' | 'FAILED' | 'UNDEFINED' | 'SKIPPED';
  readonly exception?: { readonly type: string; readonly message: string };
  readonly retried?: boolean;
  /** Omit testCaseFinished, as when a worker crashes mid-scenario. */
  readonly unfinished?: boolean;
  readonly failInHook?: boolean;
}

interface ScenarioSpec {
  readonly id: string;
  readonly name: string;
  readonly attempts: readonly AttemptSpec[];
}

/** Builds a minimal but structurally faithful Cucumber messages stream. */
function messages(scenarios: readonly ScenarioSpec[]): string {
  const lines: unknown[] = [{ hook: { id: 'hook-1', name: 'Finalize scenario' } }];
  for (const { id, name, attempts } of scenarios) {
    lines.push({
      pickle: {
        id: `pickle-${id}`,
        uri: 'features/example.feature',
        name,
        tags: [{ name: '@api' }],
        steps: [{ id: `pickle-step-${id}`, text: 'the synthetic step runs' }],
      },
    });
    lines.push({
      testCase: {
        id: `case-${id}`,
        pickleId: `pickle-${id}`,
        testSteps: [
          { id: `step-${id}`, pickleStepId: `pickle-step-${id}` },
          { id: `hook-step-${id}`, hookId: 'hook-1' },
        ],
      },
    });
    attempts.forEach((spec, attempt) => {
      const startedId = `started-${id}-${String(attempt)}`;
      lines.push({ testCaseStarted: { id: startedId, testCaseId: `case-${id}`, attempt } });
      const result = {
        status: spec.status,
        ...(spec.exception === undefined ? {} : { exception: spec.exception }),
      };
      lines.push({
        testStepFinished: {
          testCaseStartedId: startedId,
          testStepId: `step-${id}`,
          testStepResult: spec.failInHook === true ? { status: 'PASSED' } : result,
        },
      });
      lines.push({
        testStepFinished: {
          testCaseStartedId: startedId,
          testStepId: `hook-step-${id}`,
          testStepResult: spec.failInHook === true ? result : { status: 'PASSED' },
        },
      });
      if (spec.unfinished !== true) {
        lines.push({
          testCaseFinished: { testCaseStartedId: startedId, willBeRetried: spec.retried === true },
        });
      }
    });
  }
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

const assertionFailure = {
  status: 'FAILED',
  exception: {
    type: 'Error',
    message: 'expect(received).toBe(expected)\nExpected: 3\nReceived: 2',
  },
} as const;

function analyze(scenarios: readonly ScenarioSpec[]): ReturnType<typeof analyzeRun> {
  return analyzeRun(collectAttempts(parseEnvelopes(messages(scenarios))), new Redactor());
}

describe('collectAttempts', () => {
  it('reports the failing step, error type and message per attempt', () => {
    const [attempt] = collectAttempts(
      parseEnvelopes(messages([{ id: 'a', name: 'Stock an item', attempts: [assertionFailure] }])),
    );
    assert.equal(attempt?.status, 'failed');
    assert.deepEqual(attempt.failure, {
      step: 'the synthetic step runs',
      outcome: 'failed',
      errorName: 'Error',
      message: assertionFailure.exception.message,
    });
  });

  it('names the hook when teardown fails', () => {
    const [attempt] = collectAttempts(
      parseEnvelopes(
        messages([
          {
            id: 'h',
            name: 'Cleanup fails',
            attempts: [
              {
                status: 'FAILED',
                exception: { type: 'TestDataError', message: '1 cleanup action failed.' },
                failInHook: true,
              },
            ],
          },
        ]),
      ),
    );
    assert.equal(attempt?.failure?.step, 'Hook: Finalize scenario');
  });

  it('rejects invalid NDJSON with the line number', () => {
    assert.throws(() => parseEnvelopes('{}\n{not json\n'), /line 2 is not valid JSON/);
  });
});

describe('analyzeRun', () => {
  const analysis = analyze([
    { id: 'p', name: 'Passes', attempts: [{ status: 'PASSED' }] },
    {
      id: 'f',
      name: 'Fails twice',
      attempts: [{ ...assertionFailure, retried: true }, assertionFailure],
    },
    {
      id: 'k',
      name: 'Flaky',
      attempts: [
        {
          status: 'FAILED',
          exception: { type: 'LocatorError', message: 'search form could not fill "Keyword"' },
          retried: true,
        },
        { status: 'PASSED' },
      ],
    },
    { id: 'u', name: 'Undefined', attempts: [{ status: 'UNDEFINED' }] },
    { id: 's', name: 'Skipped', attempts: [{ status: 'SKIPPED' }] },
    { id: 'c', name: 'Crashed', attempts: [{ status: 'PASSED', unfinished: true }] },
  ]);

  it('counts each scenario once by its final attempt', () => {
    assert.deepEqual(analysis.totals, {
      scenarios: 6,
      passed: 1,
      failed: 2,
      flaky: 1,
      skipped: 1,
      incomplete: 1,
    });
  });

  it('classifies final failures and counts them per category', () => {
    assert.deepEqual(analysis.byCategory, { assertion: 1, 'automation-gap': 1 });
    const failed = analysis.failed.find((report) => report.scenario === 'Fails twice');
    assert.equal(failed?.attempts, 2);
    assert.equal(failed.failures.length, 2);
  });

  it('reports retried-then-passed scenarios as flaky with the earlier failure', () => {
    assert.equal(analysis.flaky[0]?.scenario, 'Flaky');
    assert.equal(analysis.flaky[0].failures[0]?.category, 'locator');
  });

  it('lists attempts that never finished', () => {
    assert.deepEqual(
      analysis.incomplete.map((report) => report.scenario),
      ['Crashed'],
    );
  });
});

describe('summarizeMessage', () => {
  const redactor = new Redactor();

  it('redacts secrets and strips ANSI colour codes', () => {
    const summary = summarizeMessage(
      '\u001b[31mRequest failed\u001b[39m\nAuthorization: Bearer synthetic.jwt.value-123456',
      redactor,
    );
    assert.ok(!summary.includes('synthetic.jwt.value-123456'));
    assert.ok(!summary.includes('\u001b['));
    assert.match(summary, /^Request failed/);
  });

  it('keeps only the head of long messages', () => {
    const summary = summarizeMessage(
      Array.from({ length: 20 }, (_, index) => `line ${String(index)}`).join('\n'),
      redactor,
    );
    assert.equal(summary.split('\n').length, 6);
    assert.ok(summarizeMessage('x'.repeat(2_000), redactor).length <= 801);
  });
});

describe('renderMarkdown', () => {
  it('summarizes failures, flaky scenarios and categories', () => {
    const markdown = renderMarkdown(
      analyze([
        { id: 'f', name: 'Fails | badly', attempts: [assertionFailure] },
        {
          id: 'k',
          name: 'Flaky',
          attempts: [{ ...assertionFailure, retried: true }, { status: 'PASSED' }],
        },
      ]),
    );
    assert.match(markdown, /\| 2 \| 0 \| 1 \| 1 \| 0 \| 0 \|/);
    assert.match(markdown, /## Failures by category/);
    assert.match(markdown, /### Fails \\\| badly/);
    assert.match(markdown, /## Flaky scenarios \(passed on retry\)/);
  });

  it('states when a run had no failures', () => {
    const markdown = renderMarkdown(
      analyze([{ id: 'p', name: 'Passes', attempts: [{ status: 'PASSED' }] }]),
    );
    assert.match(markdown, /No failures were recorded\./);
  });
});

describe('Allure categories', () => {
  const broken = (message?: string): AllureMatchingData => ({
    status: 'broken',
    flaky: false,
    ...(message === undefined ? {} : { message }),
  });

  it('splits the formatted error into name and message', () => {
    assert.deepEqual(evidenceFromReportedError('LocatorError: could not click\n    at x'), {
      errorName: 'LocatorError',
      message: 'could not click\n    at x',
    });
    assert.deepEqual(evidenceFromReportedError('plain text'), { message: 'plain text' });
  });

  it('uses the framework classifier', () => {
    assert.equal(
      classifyReportedFailure(broken('ApiRequestError: GET /x failed before a response arrived.')),
      'environment',
    );
    assert.equal(
      classifyReportedFailure(broken("The test doesn't have an implementation.")),
      'automation-gap',
    );
    assert.equal(classifyReportedFailure(broken()), 'automation-gap');
  });

  it('matches exactly one framework category per failed result, and flaky passes last', () => {
    const rules = allureCategoryRules();
    const data = broken('LocatorError: could not fill');
    const matching = rules.filter(
      (rule) => typeof rule.matchers === 'function' && rule.matchers(data),
    );
    assert.deepEqual(
      matching.map((rule) => rule.id),
      ['framework-locator'],
    );
    assert.equal(rules.at(-1)?.id, 'framework-flaky');
    const passed: AllureMatchingData = { status: 'passed', flaky: true };
    assert.ok(rules.every((rule) => typeof rule.matchers !== 'function' || !rule.matchers(passed)));
  });
});

describe('markFlakyRetries', () => {
  it('flags only the latest passing attempt after a failure, once', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'upaf-allure-'));
    try {
      const write = (name: string, result: object): Promise<void> =>
        writeFile(path.join(directory, `${name}-result.json`), JSON.stringify(result));
      await write('a1', { historyId: 'A', status: 'broken', stop: 1 });
      await write('a2', { historyId: 'A', status: 'passed', stop: 2, statusDetails: {} });
      await write('b1', { historyId: 'B', status: 'passed', stop: 1 });
      await write('c1', { historyId: 'C', status: 'passed', stop: 1 });
      await write('c2', { historyId: 'C', status: 'failed', stop: 2 });

      assert.equal(await markFlakyRetries(directory), 1);
      const flagged: unknown = JSON.parse(
        await readFile(path.join(directory, 'a2-result.json'), 'utf8'),
      );
      assert.deepEqual(flagged, {
        historyId: 'A',
        status: 'passed',
        stop: 2,
        statusDetails: { flaky: true },
      });
      assert.equal(await markFlakyRetries(directory), 0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
