import type { LogEntry, LogSink } from '../log-entry';

/** Keeps a bounded, scenario-scoped buffer that is attached to the report after the scenario. */
export class MemoryLogSink implements LogSink {
  private readonly buffer: LogEntry[] = [];
  private dropped = 0;

  public constructor(private readonly capacity = 2_000) {}

  public write(entry: LogEntry): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
      this.dropped += 1;
    }
    this.buffer.push(entry);
  }

  public entries(): readonly LogEntry[] {
    return [...this.buffer];
  }

  public droppedCount(): number {
    return this.dropped;
  }

  public toJsonLines(): string {
    return this.buffer.map((entry) => JSON.stringify(entry)).join('\n');
  }
}
