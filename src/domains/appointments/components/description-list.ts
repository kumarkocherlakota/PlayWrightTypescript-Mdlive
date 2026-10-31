import type { Locator } from '@playwright/test';

/**
 * Reads a `<dl>` inside `region` as term → definition pairs. A definition containing a `<time>`
 * yields its ISO `datetime` value instead of the localized text.
 */
export async function readDescriptionList(region: Locator): Promise<Record<string, string>> {
  const terms = (await region.getByRole('term').allInnerTexts()).map((term) => term.trim());
  const definitions = await region.getByRole('definition').all();
  const entries: [string, string][] = [];
  for (const [index, definition] of definitions.entries()) {
    const time = definition.locator('time');
    const value =
      (await time.count()) > 0
        ? new Date((await time.getAttribute('datetime')) ?? '').toISOString()
        : (await definition.innerText()).trim();
    entries.push([terms[index] ?? '', value]);
  }
  return Object.fromEntries(entries);
}
