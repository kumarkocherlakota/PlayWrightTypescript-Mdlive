import type { CustomWorld } from '@bdd/world/custom-world';

/**
 * Attaches the scenario's HTTP exchange summary when it failed, then disposes the session.
 * The summary holds methods, paths, statuses and timings only; it is redacted anyway because
 * query strings can carry data.
 */
export async function finalizeApiSession(world: CustomWorld, failed: boolean): Promise<void> {
  const session = world.detachApiSession();
  if (session === undefined) {
    return;
  }
  try {
    const exchanges = session.exchanges();
    if (failed && exchanges.length > 0) {
      world.attach(JSON.stringify(world.redactor.redact(exchanges), null, 2), {
        mediaType: 'application/json',
        fileName: 'api-exchanges.json',
      });
    }
  } finally {
    await session.close();
  }
}
