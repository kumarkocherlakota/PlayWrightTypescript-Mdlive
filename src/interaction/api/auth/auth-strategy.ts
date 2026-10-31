/**
 * Port for API authentication (ADR-012). A strategy turns credentials into request headers at
 * the moment of use; callers never handle tokens or keys themselves.
 */
export interface AuthStrategy {
  /** Business-readable name for logs, e.g. "OAuth 2.0 password grant". Never a credential. */
  readonly name: string;
  /** Headers to add to an authenticated request. May obtain or refresh a token. */
  headers(): Promise<Readonly<Record<string, string>>>;
}

/** Sends requests without credentials. */
export class NoAuth implements AuthStrategy {
  public readonly name = 'no authentication';

  public headers(): Promise<Readonly<Record<string, string>>> {
    return Promise.resolve({});
  }
}

/** Sends a fixed, deliberately invalid bearer token; for negative security tests only. */
export class StaticBearerAuth implements AuthStrategy {
  public readonly name = 'static bearer token';

  public constructor(private readonly token: string) {}

  public headers(): Promise<Readonly<Record<string, string>>> {
    return Promise.resolve({ Authorization: `Bearer ${this.token}` });
  }
}
