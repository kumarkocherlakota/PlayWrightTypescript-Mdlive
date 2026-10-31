import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ApiRequestError } from '@core/errors';
import type { ExecutionLogger } from '@core/logging';
import type { AuthStrategy } from './auth/auth-strategy';
import type { ApiResponse, HttpExchange, HttpRequest } from './http-request';

export interface HttpClientOptions {
  readonly request: APIRequestContext;
  /** Base URL including any path prefix, e.g. "https://api.qa.example.test/v1". */
  readonly baseUrl: string;
  readonly auth: AuthStrategy;
  readonly logger: ExecutionLogger;
  readonly timeoutMs: number;
  /** Responses slower than this are logged as warnings (`api.responseTimeThresholdMs`). */
  readonly slowResponseMs: number;
  /** Receives a summary of every exchange, including network failures. */
  readonly onExchange?: (exchange: HttpExchange) => void;
}

export type RequestOptions = Omit<HttpRequest, 'method' | 'path'>;

const MAX_LOGGED_BODY_CHARS = 4_000;

/**
 * Thin HTTP client over Playwright's APIRequestContext. It adds what raw requests lack: base-URL
 * joining that keeps path prefixes, authentication through a strategy, expected-status checks with
 * a typed ApiRequestError, timing, and redacted structured logging. Domain clients build on it;
 * it knows nothing about any domain.
 */
export class HttpClient {
  public constructor(private readonly options: HttpClientOptions) {}

  public get authName(): string {
    return this.options.auth.name;
  }

  public async send(request: HttpRequest): Promise<ApiResponse> {
    const url = this.resolveUrl(request);
    const target = `${url.pathname}${url.search}`;
    const headers = {
      Accept: 'application/json',
      ...(request.anonymous === true ? {} : await this.options.auth.headers()),
      ...request.headers,
    };
    this.logRequest(request, target);

    const started = performance.now();
    let raw: APIResponse;
    try {
      raw = await this.options.request.fetch(url.toString(), {
        method: request.method,
        headers,
        ...(request.json === undefined ? {} : { data: request.json }),
        ...(request.form === undefined ? {} : { form: { ...request.form } }),
        timeout: this.options.timeoutMs,
        failOnStatusCode: false,
        maxRedirects: 0,
      });
    } catch (error: unknown) {
      this.record(request, target, 'network-error', performance.now() - started);
      throw new ApiRequestError(`${request.method} ${target} failed before a response arrived.`, {
        cause: error,
        context: { method: request.method, target },
      });
    }

    const response: ApiResponse = {
      method: request.method,
      url: url.toString(),
      status: raw.status(),
      headers: raw.headers(),
      body: await readBody(raw, request.method, target),
      durationMs: Math.round(performance.now() - started),
    };
    this.record(request, target, response.status, response.durationMs);
    this.logResponse(request, target, response);
    assertExpectedStatus(request, target, response);
    return response;
  }

  public get(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.send({ ...options, method: 'GET', path });
  }

  public post(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.send({ ...options, method: 'POST', path });
  }

  public put(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.send({ ...options, method: 'PUT', path });
  }

  public patch(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.send({ ...options, method: 'PATCH', path });
  }

  public delete(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.send({ ...options, method: 'DELETE', path });
  }

  private resolveUrl(request: HttpRequest): URL {
    if (!request.path.startsWith('/') || request.path.startsWith('//')) {
      throw new ApiRequestError(`Request path "${request.path}" must start with a single "/".`, {
        context: { method: request.method, path: request.path },
      });
    }
    // new URL('/x', 'https://h/api') would drop "/api"; join explicitly to keep the prefix.
    const base = this.options.baseUrl.replace(/\/+$/, '');
    const url = new URL(`${base}${request.path}`);
    for (const [name, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(name, String(value));
      }
    }
    return url;
  }

  private record(
    request: HttpRequest,
    target: string,
    status: HttpExchange['status'],
    durationMs: number,
  ): void {
    this.options.onExchange?.({
      method: request.method,
      target,
      status,
      durationMs: Math.round(durationMs),
      timestamp: new Date().toISOString(),
    });
  }

  private logRequest(request: HttpRequest, target: string): void {
    const { logger } = this.options;
    if (request.sensitive !== true && logger.isEnabled('debug')) {
      logger.debug(`HTTP ${request.method} ${target}`, {
        auth: request.anonymous === true ? 'anonymous' : this.options.auth.name,
        ...(request.json === undefined ? {} : { body: truncate(request.json) }),
      });
    }
  }

  private logResponse(request: HttpRequest, target: string, response: ApiResponse): void {
    const { logger, slowResponseMs } = this.options;
    const summary = `HTTP ${request.method} ${target} -> ${response.status} (${response.durationMs} ms)`;
    logger.info(summary);
    if (response.durationMs > slowResponseMs) {
      logger.warn(`Slow response: ${summary}`, { thresholdMs: slowResponseMs });
    }
    if (request.sensitive !== true && logger.isEnabled('debug') && response.body !== undefined) {
      logger.debug(`HTTP ${response.status} body`, { body: truncate(response.body) });
    }
  }
}

async function readBody(raw: APIResponse, method: string, target: string): Promise<unknown> {
  const text = await raw.text();
  if (text === '') {
    return undefined;
  }
  const contentType = raw.headers()['content-type'] ?? '';
  if (!/\bjson\b/i.test(contentType)) {
    return text;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new ApiRequestError(`${method} ${target} returned invalid JSON.`, {
      cause: error,
      context: { method, target, status: raw.status(), contentType },
    });
  }
}

function assertExpectedStatus(request: HttpRequest, target: string, response: ApiResponse): void {
  if (request.expectedStatus === undefined) {
    return;
  }
  const expected = [request.expectedStatus].flat();
  if (!expected.includes(response.status)) {
    throw new ApiRequestError(
      `${request.method} ${target} returned HTTP ${response.status}; expected ${expected.join(' or ')}.`,
      {
        context: {
          method: request.method,
          target,
          status: response.status,
          expected,
          ...(request.sensitive === true ? {} : { responseBody: truncate(response.body) }),
        },
      },
    );
  }
}

/** Keeps large payloads out of logs and error context while preserving their shape for small ones. */
function truncate(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length <= MAX_LOGGED_BODY_CHARS
    ? value
    : `${text.slice(0, MAX_LOGGED_BODY_CHARS)}… (${text.length} chars)`;
}
