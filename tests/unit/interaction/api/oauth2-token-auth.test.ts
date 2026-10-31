import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { APIRequestContext } from '@playwright/test';
import { AuthenticationError, ValidationError } from '@core/errors';
import { MASK, Secret } from '@core/security';
import {
  HttpClient,
  NoAuth,
  OAuth2TokenAuth,
  SchemaValidator,
  type OAuth2Grant,
} from '@interaction/api';
import {
  createTestLogger,
  newRequestContext,
  startHttpStub,
  type HttpStub,
} from './http-stub-server';

const PASSWORD_GRANT: OAuth2Grant = {
  type: 'password',
  username: new Secret('username', 'synthetic.user@example.test'),
  password: new Secret('password', 'synthetic-password-1'),
  clientId: new Secret('client id', 'synthetic-client'),
};

describe('OAuth2TokenAuth', () => {
  let stub: HttpStub;
  let context: APIRequestContext;
  let issued = 0;

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
    issued = 0;
    stub.reply(() => {
      issued += 1;
      return {
        status: 200,
        json: { access_token: `synthetic-token-${issued}`, token_type: 'bearer', expires_in: 60 },
      };
    });
  });

  function strategy(options: { grant?: OAuth2Grant; now?: () => number; scope?: string } = {}) {
    const { logger, redactor } = createTestLogger();
    const auth = new OAuth2TokenAuth({
      tokenClient: new HttpClient({
        request: context,
        baseUrl: `${stub.url}/auth`,
        auth: new NoAuth(),
        logger,
        timeoutMs: 2_000,
        slowResponseMs: 1_000,
      }),
      tokenPath: '/token',
      grant: () => options.grant ?? PASSWORD_GRANT,
      redactor,
      validator: new SchemaValidator(),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.scope === undefined ? {} : { scope: options.scope }),
    });
    return { auth, redactor };
  }

  it('sends a form-encoded password grant and returns a bearer header', async () => {
    const { auth } = strategy({ scope: 'inventory:read' });
    assert.deepEqual(await auth.headers(), { Authorization: 'Bearer synthetic-token-1' });
    const [recorded] = stub.requests;
    assert.ok(recorded);
    const form = new URLSearchParams(recorded.body);
    assert.equal(recorded.path, '/auth/token');
    assert.equal(recorded.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.deepEqual(Object.fromEntries(form), {
      grant_type: 'password',
      username: 'synthetic.user@example.test',
      password: 'synthetic-password-1',
      client_id: 'synthetic-client',
      scope: 'inventory:read',
    });
  });

  it('sends client credentials for the client-credentials grant', async () => {
    const { auth } = strategy({
      grant: {
        type: 'client_credentials',
        clientId: new Secret('client id', 'synthetic-client'),
        clientSecret: new Secret('client secret', 'synthetic-client-secret'),
      },
    });
    await auth.headers();
    assert.deepEqual(Object.fromEntries(new URLSearchParams(stub.requests[0]?.body)), {
      grant_type: 'client_credentials',
      client_id: 'synthetic-client',
      client_secret: 'synthetic-client-secret',
    });
  });

  it('reuses the token until shortly before it expires', async () => {
    let now = 1_000_000;
    const { auth } = strategy({ now: () => now });
    await auth.headers();
    now += 29_000;
    assert.deepEqual(await auth.headers(), { Authorization: 'Bearer synthetic-token-1' });
    now += 2_000;
    assert.deepEqual(await auth.headers(), { Authorization: 'Bearer synthetic-token-2' });
    assert.equal(stub.requests.length, 2);
  });

  it('shares one token request between concurrent callers', async () => {
    const { auth } = strategy();
    await Promise.all([auth.headers(), auth.headers(), auth.headers()]);
    assert.equal(stub.requests.length, 1);
  });

  it('registers the issued token with the redactor', async () => {
    const { auth, redactor } = strategy();
    await auth.headers();
    assert.equal(redactor.redactText('token synthetic-token-1 used'), `token ${MASK} used`);
  });

  it('reports a refused grant with the OAuth error code and status', async () => {
    stub.reply(() => ({
      status: 400,
      json: { error: 'invalid_grant', error_description: 'Bad credentials' },
    }));
    await assert.rejects(
      strategy().auth.headers(),
      (error: unknown) =>
        error instanceof AuthenticationError &&
        error.message ===
          'The OAuth 2.0 password grant was refused with HTTP 400 (invalid_grant).' &&
        error.context.status === 400 &&
        error.context.error === 'invalid_grant',
    );
  });

  it('rejects token responses that break the contract or are not bearer tokens', async () => {
    stub.reply(() => ({ status: 200, json: { token_type: 'bearer' } }));
    await assert.rejects(strategy().auth.headers(), ValidationError);
    stub.reply(() => ({ status: 200, json: { access_token: 'synthetic-mac', token_type: 'mac' } }));
    await assert.rejects(strategy().auth.headers(), /only bearer tokens are supported/);
  });
});
