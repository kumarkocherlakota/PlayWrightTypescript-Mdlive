import type { IncomingMessage, ServerResponse } from 'node:http';
import { PORTAL_SESSION_COOKIE, type IdentityProvider } from '../identity';
import { readCookie, readFormBody, redirect, staticFile, type Route } from '../routing';

/**
 * Synthetic patient portal: sign-in, provider search, booking and the appointment dashboard.
 * Pages are static HTML with external scripts (the CSP forbids inline script) that call the
 * healthcare APIs with the HttpOnly session cookie.
 *
 * The cookie is not marked Secure because the reference app serves plain HTTP on localhost;
 * a real deployment must serve HTTPS and set Secure.
 */
const SIGN_IN = '/portal/sign-in';
const DASHBOARD = '/portal/dashboard';

export function portalRoutes(identity: IdentityProvider): Route[] {
  /** Serves a page only with a live session; otherwise sends the browser to sign in. */
  const protectedPage = (routePath: string, file: string): Route => {
    const page = staticFile(routePath, file);
    return {
      ...page,
      handle: (request, response, url, params) => {
        if (identity.portalPrincipal(readCookie(request, PORTAL_SESSION_COOKIE)) === undefined) {
          redirect(response, SIGN_IN);
          return undefined;
        }
        return page.handle(request, response, url, params);
      },
    };
  };

  return [
    {
      method: 'GET',
      path: '/portal',
      handle: (_request, response) => {
        redirect(response, DASHBOARD);
      },
    },
    staticFile(SIGN_IN, 'portal/sign-in.html'),
    {
      method: 'POST',
      path: '/portal/session',
      handle: async (request, response) => {
        const form = await readFormBody(request);
        const sessionId = identity.startPortalSession(
          form.get('email') ?? '',
          form.get('password') ?? '',
        );
        if (sessionId === undefined) {
          redirect(response, `${SIGN_IN}?error=invalid`);
          return;
        }
        redirect(response, DASHBOARD, {
          'Set-Cookie': sessionCookie(sessionId, identity.portalSessionTtlSeconds),
        });
      },
    },
    {
      method: 'POST',
      path: '/portal/sign-out',
      handle: (request, response) => {
        endSession(identity, request, response);
      },
    },
    protectedPage('/portal/providers', 'portal/providers.html'),
    protectedPage('/portal/book', 'portal/book.html'),
    protectedPage(DASHBOARD, 'portal/dashboard.html'),
    staticFile('/portal/assets/portal.css', 'portal/portal.css'),
    staticFile('/portal/assets/portal-api.js', 'portal/portal-api.js'),
    staticFile('/portal/assets/sign-in.js', 'portal/sign-in.js'),
    staticFile('/portal/assets/providers.js', 'portal/providers.js'),
    staticFile('/portal/assets/book.js', 'portal/book.js'),
    staticFile('/portal/assets/dashboard.js', 'portal/dashboard.js'),
  ];
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `${PORTAL_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

function endSession(
  identity: IdentityProvider,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  identity.endPortalSession(readCookie(request, PORTAL_SESSION_COOKIE));
  redirect(response, SIGN_IN, { 'Set-Cookie': sessionCookie('', 0) });
}
