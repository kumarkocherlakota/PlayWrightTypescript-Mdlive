import { assertNoBlockingViolations } from '@interaction/ui';
import type { CustomWorld } from '@bdd/world/custom-world';

/**
 * Scans the current page state, attaches the redacted result as `accessibility-scan.json`
 * (also when it fails, so the evidence is always reported), then fails on blocking violations.
 */
export async function checkAccessibility(world: CustomWorld, label: string): Promise<void> {
  const result = await world.accessibility.scan(label);
  world.attach(JSON.stringify(world.redactor.redact(result), null, 2), {
    mediaType: 'application/json',
    fileName: 'accessibility-scan.json',
  });
  assertNoBlockingViolations(result);
}
