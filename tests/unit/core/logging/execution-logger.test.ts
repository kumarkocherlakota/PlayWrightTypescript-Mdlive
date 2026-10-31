import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { MASK, Redactor } from '@core/security';

function createLogger(level: 'debug' | 'info' | 'warn' | 'error' = 'debug') {
  const sink = new MemoryLogSink();
  const logger = new ExecutionLogger({ level, redactor: new Redactor(), sinks: [sink] });
  return { sink, logger };
}

describe('ExecutionLogger', () => {
  it('redacts messages and data before they reach sinks', () => {
    const { sink, logger } = createLogger();
    logger.info('login password=s3cr3t-value', { token: 'abc', specialty: 'Cardiology' });
    const entry = sink.entries()[0];
    assert.ok(entry);
    assert.equal(entry.message, `login password=${MASK}`);
    assert.deepEqual(entry.data, { token: MASK, specialty: 'Cardiology' });
  });

  it('filters entries below the configured level', () => {
    const { sink, logger } = createLogger('warn');
    logger.info('ignored');
    logger.warn('kept');
    assert.deepEqual(
      sink.entries().map((entry) => entry.message),
      ['kept'],
    );
  });

  it('adds correlation context in child loggers', () => {
    const { sink, logger } = createLogger();
    logger.child({ scenario: 'S1', correlationId: 'c-1' }).info('hello');
    assert.deepEqual(sink.entries()[0]?.context, { scenario: 'S1', correlationId: 'c-1' });
  });

  it('bounds the memory buffer', () => {
    const sink = new MemoryLogSink(2);
    const logger = new ExecutionLogger({ level: 'debug', redactor: new Redactor(), sinks: [sink] });
    logger.info('1');
    logger.info('2');
    logger.info('3');
    assert.equal(sink.entries().length, 2);
    assert.equal(sink.droppedCount(), 1);
  });
});
