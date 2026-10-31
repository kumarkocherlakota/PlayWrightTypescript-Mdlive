/**
 * Counts attempts per scenario within a worker, because Cucumber does not expose the retry number
 * to hooks. Retries of a scenario run in the same worker, so a per-worker counter is accurate.
 */
export class AttemptTracker {
  private readonly attempts = new Map<string, number>();

  public next(scenarioId: string): number {
    const attempt = (this.attempts.get(scenarioId) ?? 0) + 1;
    this.attempts.set(scenarioId, attempt);
    return attempt;
  }
}
