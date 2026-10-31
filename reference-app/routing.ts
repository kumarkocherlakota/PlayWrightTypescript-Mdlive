import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

export interface Route {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  handle(request: IncomingMessage, response: ServerResponse, url: URL): void | Promise<void>;
}

const PUBLIC_DIRECTORY = path.join(__dirname, 'public');

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
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
