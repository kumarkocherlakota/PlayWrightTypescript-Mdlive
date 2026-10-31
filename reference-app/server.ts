/**
 * LOCAL SYNTHETIC REFERENCE APPLICATION — not a real system and contains no real data.
 * It exists so framework self-tests (and, from Phase 5, the healthcare reference scenarios) can
 * execute without access to a live environment. Results against it say nothing about any real
 * application.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { IdentityProvider, type IdentityOptions } from './identity';
import { authRoutes } from './routes/auth-routes';
import { galleryRoutes } from './routes/gallery-routes';
import { inventoryRoutes } from './routes/inventory-routes';
import { HttpProblem, matchPath, sendJson, type Route } from './routing';

export interface ReferenceAppOptions {
  readonly host: string;
  readonly port: number;
  /** Accounts the synthetic identity provider accepts; none means every token request fails. */
  readonly identity?: IdentityOptions;
  readonly routes?: readonly Route[];
}

export interface ReferenceAppHandle {
  readonly url: string;
  close(): Promise<void>;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

export async function startReferenceApp(options: ReferenceAppOptions): Promise<ReferenceAppHandle> {
  const identity = new IdentityProvider(options.identity);
  const routes = options.routes ?? [
    ...galleryRoutes,
    ...authRoutes(identity),
    ...inventoryRoutes(identity),
    healthRoute,
  ];
  const server = createServer((request, response) => {
    void handle(routes, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Reference app did not bind to a TCP port.');
  }
  return {
    url: `http://${options.host}:${address.port}`,
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

const healthRoute: Route = {
  method: 'GET',
  path: '/health',
  handle: (_request, response) => {
    sendJson(response, 200, { status: 'ok', synthetic: true });
  },
};

async function handle(
  routes: readonly Route[],
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
  const url = new URL(request.url ?? '/', 'http://reference-app.local');
  const matched = routes
    .filter((candidate) => candidate.method === request.method)
    .map((route) => ({ route, params: matchPath(route.path, url.pathname) }))
    .find((candidate) => candidate.params !== undefined);
  if (matched?.params === undefined) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  try {
    await matched.route.handle(request, response, url, matched.params);
  } catch (error) {
    if (error instanceof HttpProblem) {
      sendJson(response, error.status, error.body);
      return;
    }
    // Respond like a real service (generic 500, no details) but surface the cause to developers.
    console.error(`[reference-app] ${request.method ?? ''} ${url.pathname} failed:`, error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'internal_error' });
    }
  }
}
