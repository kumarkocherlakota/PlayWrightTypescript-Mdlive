import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

export type RouteParams = Readonly<Record<string, string>>;

export interface Route {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Exact path; segments written as `:name` match one segment and arrive in `params`. */
  readonly path: string;
  handle(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    params: RouteParams,
  ): void | Promise<void>;
}

const PUBLIC_DIRECTORY = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 16 * 1024;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/** Thrown by body readers; the server turns it into the given status with a JSON error. */
export class HttpProblem extends Error {
  public constructor(
    public readonly status: number,
    public readonly body: Readonly<Record<string, unknown>>,
  ) {
    super(`HTTP ${status}`);
  }
}

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(body));
}

export function sendEmpty(response: ServerResponse, status: number): void {
  response.writeHead(status);
  response.end();
}

/** Returns route params when `pattern` matches `pathname`, otherwise undefined. */
export function matchPath(pattern: string, pathname: string): RouteParams | undefined {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index] ?? '';
    if (segment.startsWith(':')) {
      if (value === '') {
        return undefined;
      }
      params[segment.slice(1)] = decodeURIComponent(value);
    } else if (segment !== value) {
      return undefined;
    }
  }
  return params;
}

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  requireContentType(request, 'application/json');
  try {
    return JSON.parse(await readText(request)) as unknown;
  } catch (error) {
    if (error instanceof HttpProblem) {
      throw error;
    }
    throw new HttpProblem(400, { error: 'invalid_json' });
  }
}

export async function readFormBody(request: IncomingMessage): Promise<URLSearchParams> {
  requireContentType(request, 'application/x-www-form-urlencoded');
  return new URLSearchParams(await readText(request));
}

function requireContentType(request: IncomingMessage, expected: string): void {
  const actual = (request.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
  if (actual !== expected) {
    throw new HttpProblem(415, { error: 'unsupported_media_type', expected });
  }
}

async function readText(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpProblem(413, { error: 'payload_too_large', maxBytes: MAX_BODY_BYTES });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Route serving one fixed file from `public/`; no user-controlled paths reach the file system. */
export function staticFile(routePath: string, relativeFile: string): Route {
  const file = path.join(PUBLIC_DIRECTORY, relativeFile);
  return {
    method: 'GET',
    path: routePath,
    handle: async (_request, response) => {
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    },
  };
}
