import type { LogLevel } from '@core/config';

export const LOG_LEVEL_SEVERITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Correlation fields attached to every entry written by a logger and its children. */
export interface LogContext {
  readonly runId?: string;
  readonly workerId?: string;
  readonly environment?: string;
  readonly browser?: string;
  readonly scenario?: string;
  readonly attempt?: number;
  readonly correlationId?: string;
  readonly component?: string;
}

/** A fully redacted log record. Sinks may write it as-is. */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext;
  readonly data?: unknown;
}

export interface LogSink {
  write(entry: LogEntry): void;
}
