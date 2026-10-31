import type { LogEntry, LogSink } from '../log-entry';

/** Human-readable output on stderr, so it does not interleave with Cucumber formatter stdout. */
export class ConsoleLogSink implements LogSink {
  public write(entry: LogEntry): void {
    const scope = entry.context.scenario ?? entry.context.component ?? 'run';
    const data = entry.data === undefined ? '' : ` ${JSON.stringify(entry.data)}`;
    console.error(
      `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} [${scope}] ${entry.message}${data}`,
    );
  }
}
