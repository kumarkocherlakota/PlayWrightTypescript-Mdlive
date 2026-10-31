export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type QueryValue = string | number | boolean;

export interface HttpRequest {
  readonly method: HttpMethod;
  /** Path relative to the client's base URL, e.g. "/inventory/items". */
  readonly path: string;
  readonly query?: Readonly<Record<string, QueryValue | undefined>>;
  /** JSON body; mutually exclusive with `form`. */
  readonly json?: unknown;
  /** `application/x-www-form-urlencoded` body; mutually exclusive with `json`. */
  readonly form?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Status codes that count as success. When set, any other status throws an ApiRequestError.
   * Leave unset for negative tests that inspect the status themselves.
   */
  readonly expectedStatus?: number | readonly number[];
  /** Omit authentication headers for this request (e.g. to test that a token is required). */
  readonly anonymous?: boolean;
  /**
   * Never log request or response bodies, even redacted. Use for credential exchanges, where the
   * body exists only to carry secrets.
   */
  readonly sensitive?: boolean;
}

/** A completed HTTP exchange. `body` is parsed JSON, text, or undefined for empty responses. */
export interface ApiResponse {
  readonly method: HttpMethod;
  readonly url: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly durationMs: number;
}

/** Non-sensitive summary of one exchange, kept for failure reports. */
export interface HttpExchange {
  readonly method: HttpMethod;
  /** Path and query only; never the host or credentials. */
  readonly target: string;
  readonly status: number | 'network-error';
  readonly durationMs: number;
  readonly timestamp: string;
}
