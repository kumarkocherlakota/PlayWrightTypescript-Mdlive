import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { ArtifactManager, slugify } from '@core/artifacts';

describe('ArtifactManager', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'artifacts-'));
  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('produces distinct paths per scenario attempt', () => {
    const manager = new ArtifactManager(root);
    const first = manager.forScenario({ name: 'Book appointment', id: 'p1', attempt: 1 });
    const retry = manager.forScenario({ name: 'Book appointment', id: 'p1', attempt: 2 });
    const other = manager.forScenario({ name: 'Book appointment', id: 'p2', attempt: 1 });
    const paths = [first, retry, other].map((item) => item.pathFor('screenshots', 'png'));
    assert.equal(new Set(paths).size, 3);
    assert.ok(paths.every((file) => file.startsWith(path.join(root, 'screenshots'))));
  });

  it('creates file-system safe slugs', () => {
    assert.equal(
      slugify('Book: appointment / "cardiology" <QA>'),
      'book-appointment-cardiology-qa',
    );
    assert.equal(slugify('***'), 'unnamed');
    assert.ok(slugify('x'.repeat(500)).length <= 60);
  });
});
