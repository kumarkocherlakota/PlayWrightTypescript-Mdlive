import path from 'node:path';
import { PROJECT_ROOT } from '@core/config';
import { serializeError } from '@core/errors';
import type { CustomWorld } from '@bdd/world/custom-world';

/**
 * Collects UI failure evidence, then closes the scenario's context. Evidence collection errors
 * are logged and attached (never hidden) but do not prevent the context from closing.
 */
export async function finalizeUiSession(world: CustomWorld, failed: boolean): Promise<void> {
  const session = world.detachUiSession();
  if (session === undefined) {
    return;
  }
  const policy = world.config.artifacts.screenshot;

  try {
    if (policy === 'on' || (policy === 'only-on-failure' && failed)) {
      const { image } = await session.captureScreenshot();
      world.attach(image, { mediaType: 'image/png', fileName: 'screenshot.png' });
    }
    if (failed) {
      world.attach(JSON.stringify(world.redactor.redact(session.diagnostics()), null, 2), {
        mediaType: 'application/json',
        fileName: 'ui-diagnostics.json',
      });
    }
  } catch (error: unknown) {
    const details = serializeError(error);
    world.logger.error('Failed to collect UI failure evidence', details);
    world.attach(
      `Failed to collect UI failure evidence: ${world.redactor.redactText(details.message)}`,
    );
  } finally {
    const { tracePath, videoPath } = await session.close(failed);
    const paths = {
      ...(tracePath === undefined ? {} : { trace: path.relative(PROJECT_ROOT, tracePath) }),
      ...(videoPath === undefined ? {} : { video: path.relative(PROJECT_ROOT, videoPath) }),
    };
    if (Object.keys(paths).length > 0) {
      world.logger.info('UI artifacts retained', paths);
      world.attach(JSON.stringify(paths, null, 2), {
        mediaType: 'application/json',
        fileName: 'ui-artifacts.json',
      });
    }
  }
}
