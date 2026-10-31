import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  describeFindings,
  scanReportDirectory,
  scanText,
} from '../../../tools/security/report-leak-scanner';

// Synthetic values assembled at runtime so this file itself contains no token-shaped literals.
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJzeW50aGV0aWMifQ', 'c2lnbmF0dXJl'].join('.');
const TEST_CARD = ['4111', '1111', '1111', '1111'].join(' ');
const RUN_SECRET = `Syn-${'x'.repeat(12)}!9`;

function kinds(text: string, knownSecrets: readonly string[] = []): string[] {
  return scanText(text, 'report.json', { knownSecrets }).map((finding) => finding.kind);
}

describe('scanText', () => {
  it('finds unredacted tokens, credentials, personal data and known secrets', () => {
    assert.deepEqual(kinds(`{"note":"${JWT}"}`), ['jwt']);
    assert.deepEqual(kinds(`Authorization: Bearer ${'a1'.repeat(12)}`), ['authorization-scheme']);
    assert.deepEqual(kinds('GET /cb?password=hunter2-synthetic'), ['sensitive-assignment']);
    assert.deepEqual(kinds('contact synthetic.person@example.test'), ['email']);
    assert.deepEqual(kinds('GET /members/synthetic.person@example.test'), ['email']);
    assert.deepEqual(kinds(`card ${TEST_CARD}`), ['payment-card']);
    assert.deepEqual(kinds(`"pan":"${TEST_CARD.replaceAll(' ', '')}"`), ['payment-card']);
    assert.deepEqual(kinds(`typed ${RUN_SECRET} into the form`, [RUN_SECRET]), ['known-secret']);
  });

  it('ignores masked values, step wording and identifiers that only look sensitive', () => {
    assert.deepEqual(kinds('Calling API with Authorization: Bearer ***'), []);
    assert.deepEqual(kinds('Given a synthetic bearer token is written to the log'), []);
    assert.deepEqual(kinds('password=*** and {"email":"***"}'), []);
    assert.deepEqual(kinds(String.raw`"message":"password=***\\\",\\\"context"`), []);
    assert.deepEqual(kinds('"video": "reports/videos/run-1/page@8682be8c9318.webm"'), []);
    assert.deepEqual(kinds('{"start":1793462440543}'), []);
    assert.deepEqual(kinds('"correlationId":"501b25e1-5893-45c9-9784-340620990005"'), []);
    // Digit groups at the start of a UUID can pass the Luhn check.
    assert.deepEqual(kinds('{"uuid":"43370976-4689-4610-9cc5-cc07c544d17d"}'), []);
    assert.deepEqual(kinds('short secret abc', ['abc']), []);
  });

  it('reports the line of each finding', () => {
    const findings = scanText(`clean\nclean\n${JWT}`, 'log.jsonl');
    assert.deepEqual(findings, [{ file: 'log.jsonl', line: 3, kind: 'jwt' }]);
  });
});

describe('scanReportDirectory', () => {
  let root: string;

  before(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'leak-scan-'));
    await mkdir(path.join(root, 'logs'));
    await mkdir(path.join(root, 'allure-report'));
    await writeFile(path.join(root, 'logs', 'worker-0.jsonl'), `{"m":"${RUN_SECRET}"}\n`);
    await writeFile(path.join(root, 'logs', 'clean.json'), '{"m":"nothing here"}');
    await writeFile(path.join(root, 'allure-report', 'app.js'), `x=${JWT}`);
    await writeFile(path.join(root, 'screenshot.png'), JWT);
  });
  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('scans text reports, skips generated sites and binaries, and never prints values', async () => {
    const result = await scanReportDirectory(root, { knownSecrets: [RUN_SECRET] });
    assert.equal(result.filesScanned, 2);
    assert.deepEqual(
      result.findings.map((finding) => [path.basename(finding.file), finding.kind]),
      [['worker-0.jsonl', 'known-secret']],
    );
    const summary = describeFindings(result);
    assert.ok(!summary.includes(RUN_SECRET));
    assert.match(summary, /Report leak scan: 2 files, 1 findings\./);
  });
});
