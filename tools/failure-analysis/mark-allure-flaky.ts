import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const allureResultSchema = z.looseObject({
  historyId: z.string().optional(),
  status: z.string().optional(),
  stop: z.number().optional(),
  statusDetails: z.looseObject({ flaky: z.boolean().optional() }).optional(),
});

type AllureResult = z.infer<typeof allureResultSchema>;

interface ResultFile {
  readonly file: string;
  readonly result: AllureResult;
}

const FAILED_STATUSES = new Set(['failed', 'broken']);

/**
 * Allure 3 detects flakiness from history only, so a scenario that failed and then passed on a
 * retry within the same run would look stable. Every attempt shares a historyId; when the latest
 * attempt passed after a failed one, its standard `statusDetails.flaky` flag is set.
 * Idempotent. Returns the number of results marked.
 */
export async function markFlakyRetries(resultsDirectory: string): Promise<number> {
  const names = (await readdir(resultsDirectory)).filter((name) => name.endsWith('-result.json'));
  const byHistory = new Map<string, ResultFile[]>();
  for (const name of names) {
    const file = path.join(resultsDirectory, name);
    const result = allureResultSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    if (result.historyId !== undefined) {
      byHistory.set(result.historyId, [
        ...(byHistory.get(result.historyId) ?? []),
        { file, result },
      ]);
    }
  }

  let marked = 0;
  for (const attempts of byHistory.values()) {
    const ordered = [...attempts].sort(
      (left, right) => (left.result.stop ?? 0) - (right.result.stop ?? 0),
    );
    const latest = ordered.at(-1);
    const failedBefore = ordered
      .slice(0, -1)
      .some(({ result }) => FAILED_STATUSES.has(result.status ?? ''));
    if (
      latest?.result.status === 'passed' &&
      failedBefore &&
      latest.result.statusDetails?.flaky !== true
    ) {
      const updated = {
        ...latest.result,
        statusDetails: { ...latest.result.statusDetails, flaky: true },
      };
      await writeFile(latest.file, JSON.stringify(updated));
      marked += 1;
    }
  }
  return marked;
}
