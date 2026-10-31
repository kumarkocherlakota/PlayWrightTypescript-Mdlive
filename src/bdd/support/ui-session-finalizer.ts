import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT } from '@core/config';
import { serializeError } from '@core/errors';
import type { CustomWorld } from '@bdd/world/custom-world';

const BYTES_PER_MB = 1024 * 1024;

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
    reportEvidenceError(world, 'Failed to collect UI failure evidence', error);
  } finally {
    const { tracePath, videoPath } = await session.close(failed);
    await attachRetainedArtifacts(world, failed, tracePath, videoPath);
  }
}

/**
 * Traces are referenced by path only: they record request headers and cookies, which cannot be
 * redacted, so they must not be copied into shareable reports. Videos are embedded on failure.
 */
async function attachRetainedArtifacts(
  world: CustomWorld,
  failed: boolean,
  tracePath: string | undefined,
  videoPath: string | undefined,
): Promise<void> {
  const relative = (file: string): string => path.relative(PROJECT_ROOT, file);
  const paths = {
    ...(tracePath === undefined
      ? {}
      : {
          trace: relative(tracePath),
          openTrace: `npx playwright show-trace ${relative(tracePath)}`,
        }),
    ...(videoPath === undefined ? {} : { video: relative(videoPath) }),
  };
  if (Object.keys(paths).length === 0) {
    return;
  }
  world.logger.info('UI artifacts retained', paths);
  world.attach(JSON.stringify(paths, null, 2), {
    mediaType: 'application/json',
    fileName: 'ui-artifacts.json',
  });

  if (!failed || videoPath === undefined) {
    return;
  }
  try {
    const limitMb = world.config.artifacts.maxAttachmentMb;
    const { size } = await stat(videoPath);
    if (size > limitMb * BYTES_PER_MB) {
      world.attach(
        `Video not embedded: ${(size / BYTES_PER_MB).toFixed(1)} MB exceeds ` +
          `artifacts.maxAttachmentMb (${String(limitMb)} MB). See ${relative(videoPath)}.`,
      );
      return;
    }
    world.attach(await readFile(videoPath), { mediaType: 'video/webm', fileName: 'video.webm' });
  } catch (error: unknown) {
    reportEvidenceError(world, 'Failed to attach the failure video', error);
  }
}

function reportEvidenceError(world: CustomWorld, summary: string, error: unknown): void {
  const details = serializeError(error);
  world.logger.error(summary, details);
  world.attach(`${summary}: ${world.redactor.redactText(details.message)}`);
}
