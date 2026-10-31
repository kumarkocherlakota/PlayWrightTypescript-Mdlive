import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { APIRequestContext } from '@playwright/test';
import { ApiRequestError } from '@core/errors';
import { HttpClient, NoAuth, StaticBearerAuth, type HttpExchange } from '@interaction/api';
import {
  createTestLogger,
  newRequestContext,
  startHttpStub,
  type HttpStub,
} from './http-stub-server';

describe('HttpClient', () => {
  let stub: HttpStub;
  let context: APIRequestContext;

  before(async () => {
    stub = await startHttpStub();
    context = await newRequestContext();
  });
  after(async () => {
    await context.dispose();
    await stub.close();
  });
  beforeEach(() => {
    stub.requests.length = 0;
  });

  function client(options: { slowResponseMs?: number; exchanges?: HttpExchange[] } = {}) {
    const { logger, logs } = createTestLogger();
    const http = new HttpClient({
      request: context,
      baseUrl: `${stub.url}/api/v1/`,
      auth: new StaticBearerAuth('synthetic-token-value'),
      logger,
      timeoutMs: 2_000,
      slowResponseMs: options.slowResponseMs ?? 1_000,
      onExchange: (exchange) => options.exchanges?.push(exchange),
    });
    return { http, logs };
  }

  it('keeps the base path prefix, encodes the query and sends auth and JSON', async () => {
    stub.reply(() => ({ status: 201, json: { id: 'synthetic-1' } }));
    const { http } = client();
    const response = await http.post('/items', {
      json: { name: 'Widget' },
      query: { tag: 'a b', limit: 5, skipped: undefined },
      expectedStatus: 201,
    });
    const [recorded] = stub.requests;
    assert.equal(recorded?.path, '/api/v1/items?tag=a+b&limit=5');
    assert.equal(recorded.headers.authorization, 'Bearer synthetic-token-value');
    assert.deepEqual(JSON.parse(recorded.body), { name: 'Widget' });
    assert.deepEqual(response.body, { id: 'synthetic-1' });
    assert.equal(response.status, 201);
  });

  it('omits authentication for anonymous requests', async () => {
    stub.reply(() => ({ status: 401, json: { error: 'unauthorized' } }));
    await client().http.get('/items', { anonymous: true });
    assert.equal(stub.requests[0]?.headers.authorization, undefined);
  });

  it('throws an ApiRequestError with status details when the status is unexpected', async () => {
    stub.reply(() => ({ status: 500, json: { error: 'internal_error' } }));
    await assert.rejects(
      client().http.get('/items', { expectedStatus: [200, 404] }),
      (error: unknown) =>
        error instanceof ApiRequestError &&
        error.message === 'GET /api/v1/items returned HTTP 500; expected 200 or 404.' &&
        error.context.status === 500,
    );
  });

  it('returns text bodies as text and empty bodies as undefined', async () => {
    stub.reply((request) =>
      request.method === 'DELETE' ? { status: 204 } : { status: 200, text: 'plain words' },
    );
    const { http } = client();
    assert.equal((await http.get('/text')).body, 'plain words');
    assert.equal((await http.delete('/items/1')).body, undefined);
  });

  it('rejects invalid JSON with an ApiRequestError', async () => {
    stub.reply(() => ({ status: 200, text: '{not json', contentType: 'application/json' }));
    await assert.rejects(client().http.get('/items'), /returned invalid JSON/);
  });

  it('rejects paths that could escape the base URL', async () => {
    const { http } = client();
    await assert.rejects(http.get('items'), ApiRequestError);
    await assert.rejects(http.get('//evil.example.test/items'), ApiRequestError);
    assert.equal(stub.requests.length, 0);
  });

  it('wraps network failures and records them as exchanges', async () => {
    const exchanges: HttpExchange[] = [];
    const { logger } = createTestLogger();
    const unreachable = new HttpClient({
      request: context,
      baseUrl: 'http://127.0.0.1:9',
      auth: new NoAuth(),
      logger,
      timeoutMs: 2_000,
      slowResponseMs: 1_000,
      onExchange: (exchange) => exchanges.push(exchange),
    });
    await assert.rejects(unreachable.get('/items'), /failed before a response arrived/);
    assert.equal(exchanges[0]?.status, 'network-error');
  });

  it('records exchanges and warns about slow responses', async () => {
    stub.reply(() => ({ status: 200, json: { ok: true }, delayMs: 60 }));
    const exchanges: HttpExchange[] = [];
    const { http, logs } = client({ slowResponseMs: 10, exchanges });
    await http.get('/slow');
    assert.deepEqual(
      exchanges.map(({ method, target, status }) => ({ method, target, status })),
      [{ method: 'GET', target: '/api/v1/slow', status: 200 }],
    );
    assert.ok(
      logs
        .entries()
        .some((entry) => entry.level === 'warn' && entry.message.startsWith('Slow response')),
    );
  });

  it('never logs bodies of sensitive requests', async () => {
    stub.reply(() => ({ status: 200, json: { access_token: 'synthetic-access-token' } }));
    const { http, logs } = client();
    await http.post('/token', { form: { password: 'synthetic-password' }, sensitive: true });
    const logged = logs.toJsonLines();
    assert.ok(!logged.includes('synthetic-access-token'));
    assert.ok(!logged.includes('synthetic-password'));
    assert.match(logged, /HTTP POST \/api\/v1\/token -> 200/);
  });
});
