import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { LogEntry, LogSink } from '../log-entry';

/**
 * Appends JSON lines to a per-worker file. Synchronous writes keep entries ordered and ensure
 * nothing is lost if the worker exits on a failure.
 */
export class FileLogSink implements LogSink {
  public constructor(private readonly filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }

  public write(entry: LogEntry): void {
    appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
