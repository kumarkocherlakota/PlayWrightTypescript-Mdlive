import type { LogLevel } from '@core/config';
import type { Redactor } from '@core/security';
import { LOG_LEVEL_SEVERITY, type LogContext, type LogEntry, type LogSink } from './log-entry';

export interface ExecutionLoggerOptions {
  readonly level: LogLevel;
  readonly redactor: Redactor;
  readonly sinks: readonly LogSink[];
  readonly context?: LogContext;
}

/**
 * Structured, redacting logger. Every message and data payload passes through the Redactor
 * before reaching any sink, so sinks never see raw secrets or PHI/PII.
 */
export class ExecutionLogger {
  private readonly context: LogContext;

  public constructor(private readonly options: ExecutionLoggerOptions) {
    this.context = options.context ?? {};
  }

  public debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  public error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }

  /** Returns a logger that shares sinks and redactor but adds correlation context. */
  public child(context: LogContext): ExecutionLogger {
    return new ExecutionLogger({ ...this.options, context: { ...this.context, ...context } });
  }

  public isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[this.options.level];
  }

  private write(level: LogLevel, message: string, data: unknown): void {
    if (!this.isEnabled(level)) {
      return;
    }
    const { redactor } = this.options;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: redactor.redactText(message),
      context: this.context,
      ...(data === undefined ? {} : { data: redactor.redact(data) }),
    };
    for (const sink of this.options.sinks) {
      sink.write(entry);
    }
  }
}
