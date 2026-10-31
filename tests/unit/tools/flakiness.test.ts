import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  analyzeFlakiness,
  recordsFromRun,
  renderFlakinessMarkdown,
  trimToRecentRuns,
  type HistoryRecord,
} from '../../../tools/flakiness/flakiness-history';
import { readHistory } from '../../../tools/flakiness/write-flakiness';

function record(
  run: number,
  location: string,
  status: HistoryRecord['status'],
  overrides: Partial<HistoryRecord> = {},
): HistoryRecord {
  return {
    runStartedAt: `2026-10-0${String(run)}T00:00:00.000Z`,
    browser: 'chromium',
    location,
    status,
    attempts: 1,
    flakyInRun: false,
    ...overrides,
  };
}

describe('flakiness analysis', () => {
  it('reports mixed outcomes and retried passes as unstable, most flips first', () => {
    const report = analyzeFlakiness([
      record(1, 'a.feature:3', 'passed'),
      record(2, 'a.feature:3', 'failed'),
      record(3, 'a.feature:3', 'passed'),
      record(1, 'b.feature:5', 'passed'),
      record(2, 'b.feature:5', 'passed', { attempts: 2, flakyInRun: true }),
      record(3, 'b.feature:5', 'passed'),
      record(1, 'c.feature:7', 'passed'),
      record(2, 'c.feature:7', 'passed'),
    ]);
    assert.equal(report.runsAnalysed, 3);
    assert.equal(report.scenariosAnalysed, 3);
    assert.deepEqual(
      report.unstable.map((scenario) => [scenario.location, scenario.flipRate, scenario.flakyRuns]),
      [
        ['a.feature:3', 1, 0],
        ['b.feature:5', 0, 1],
      ],
    );
    assert.deepEqual(report.consistentlyFailing, []);
  });

  it('treats every-run failures as broken rather than flaky, per browser', () => {
    const report = analyzeFlakiness([
      record(1, 'a.feature:3', 'failed', { browser: 'webkit' }),
      record(2, 'a.feature:3', 'failed', { browser: 'webkit' }),
      record(1, 'a.feature:3', 'passed'),
    ]);
    assert.deepEqual(report.unstable, []);
    assert.deepEqual(report.consistentlyFailing, ['a.feature:3 (webkit)']);
    assert.match(renderFlakinessMarkdown(report), /`a\.feature:3 \(webkit\)`/);
  });

  it('keeps only the most recent runs', () => {
    const records = [1, 2, 3, 4].map((run) => record(run, 'a.feature:3', 'passed'));
    assert.deepEqual(
      trimToRecentRuns(records, 2).map((entry) => entry.runStartedAt),
      [records[2]?.runStartedAt, records[3]?.runStartedAt],
    );
  });

  it('records nothing for a messages stream without a recorded run start', () => {
    assert.deepEqual(recordsFromRun([], 'chromium'), []);
  });
});

describe('flakiness history file', () => {
  it('reads a missing file as empty and rejects corrupt records', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'flakiness-'));
    try {
      const file = path.join(directory, 'history.jsonl');
      assert.deepEqual(await readHistory(file), []);
      await writeFile(
        file,
        `${JSON.stringify(record(1, 'a.feature:3', 'passed'))}\n{"status":"x"}\n`,
      );
      await assert.rejects(readHistory(file), /history\.jsonl:2 is not a valid history record/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
