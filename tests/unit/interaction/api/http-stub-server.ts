import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { ExecutionLogger, MemoryLogSink } from '@core/logging';
import { Redactor } from '@core/security';

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingMessage['headers'];
  readonly body: string;
}

export interface StubReply {
  readonly status: number;
  readonly json?: unknown;
  readonly text?: string;
  readonly contentType?: string;
  readonly delayMs?: number;
}

export type StubHandler = (request: RecordedRequest) => StubReply;

/** A local HTTP server on an ephemeral port that records requests and replies from a handler. */
export interface HttpStub {
  readonly url: string;
  readonly requests: RecordedRequest[];
  reply(handler: StubHandler): void;
  close(): Promise<void>;
}

export async function startHttpStub(): Promise<HttpStub> {
  const requests: RecordedRequest[] = [];
  let handler: StubHandler = () => ({ status: 404, json: { error: 'no handler' } });

  const server = createServer((incoming, outgoing) => {
    void respond(incoming, outgoing);
  });
  async function respond(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    const recorded: RecordedRequest = {
      method: incoming.method ?? '',
      path: incoming.url ?? '',
      headers: incoming.headers,
      body: Buffer.concat(chunks).toString('utf8'),
    };
    requests.push(recorded);
    const reply = handler(recorded);
    if (reply.delayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
    }
    const body = reply.json === undefined ? (reply.text ?? '') : JSON.stringify(reply.json);
    outgoing.writeHead(reply.status, {
      'Content-Type':
        reply.contentType ?? (reply.json === undefined ? 'text/plain' : 'application/json'),
    });
    outgoing.end(body);
  }

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Stub server did not bind to a TCP port.');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    reply: (next) => {
      handler = next;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
  };
}

export function createTestLogger(): {
  logger: ExecutionLogger;
  logs: MemoryLogSink;
  redactor: Redactor;
} {
  const logs = new MemoryLogSink();
  const redactor = new Redactor();
  return {
    logs,
    redactor,
    logger: new ExecutionLogger({ level: 'debug', redactor, sinks: [logs] }),
  };
}

export function newRequestContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext();
}
