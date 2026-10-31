import type { Secret } from '@core/security';
import type { AuthStrategy } from './auth-strategy';

/** Sends a static API key in a configurable header (`auth.apiKeyHeader`). */
export class ApiKeyAuth implements AuthStrategy {
  public readonly name = 'API key';

  public constructor(
    private readonly headerName: string,
    /** Resolved on first use, so scenarios that never authenticate never need the secret. */
    private readonly key: () => Secret,
  ) {}

  /** A missing secret rejects the returned promise rather than throwing synchronously. */
  public headers(): Promise<Readonly<Record<string, string>>> {
    return Promise.resolve().then(() => ({ [this.headerName]: this.key().reveal() }));
  }
}
