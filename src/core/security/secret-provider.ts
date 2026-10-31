import type { EnvironmentSource, SecretName } from '@core/config';
import { ConfigurationError } from '@core/errors';
import type { Redactor } from './redactor';
import { Secret } from './secret';

/**
 * Port for secret retrieval. Adapters for a vault (Azure Key Vault, AWS Secrets Manager,
 * HashiCorp Vault) implement the same contract without changing callers (ADR-009).
 */
export interface SecretProvider {
  /** Returns the secret or throws a ConfigurationError naming the missing variable. */
  require(name: SecretName): Secret;
  find(name: SecretName): Secret | undefined;
}

/**
 * Reads secrets from environment variables. Every value handed out is registered with the
 * redactor so it is masked even when it appears inside unrelated text.
 */
export class EnvironmentSecretProvider implements SecretProvider {
  public constructor(
    private readonly source: EnvironmentSource,
    private readonly redactor: Redactor,
  ) {}

  public require(name: SecretName): Secret {
    const secret = this.find(name);
    if (secret === undefined) {
      throw new ConfigurationError(
        `Required secret "${name}" is not set. Provide it as an environment variable or CI secret.`,
        { context: { secret: name } },
      );
    }
    return secret;
  }

  public find(name: SecretName): Secret | undefined {
    const value = this.source.get(name);
    if (value === undefined) {
      return undefined;
    }
    this.redactor.registerSensitiveValue(value);
    return new Secret(name, value);
  }
}
