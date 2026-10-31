import { LocatorError } from '@core/errors';

const MAX_SUMMARY_LINES = 3;

/**
 * Converts a Playwright failure into a LocatorError that names the business-level target and
 * action, keeps the original error as `cause`, and repeats its first lines so the report stays
 * readable without expanding the cause chain.
 */
export function uiActionFailed(target: string, action: string, cause: unknown): LocatorError {
  const summary =
    cause instanceof Error
      ? stripAnsi(cause.message).split('\n').slice(0, MAX_SUMMARY_LINES).join(' | ')
      : String(cause);
  return new LocatorError(`${target} could not ${action}: ${summary}`, {
    cause,
    context: { target, action },
  });
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex -- matching terminal color codes is the intent
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}
