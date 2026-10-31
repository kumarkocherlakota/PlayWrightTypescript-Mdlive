import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseDotEnv } from 'dotenv';
import { PROJECT_ROOT } from './project-root';
import type { EnvironmentVariableName } from './environment-variables';

/** Read-only access to environment variables. The only abstraction over process.env. */
export interface EnvironmentSource {
  get(name: EnvironmentVariableName): string | undefined;
}

/**
 * Reads the real process environment, falling back to a local git-ignored `.env` file.
 * Real environment variables always win over `.env`. `process.env` is never mutated.
 */
export class ProcessEnvironmentSource implements EnvironmentSource {
  private readonly dotEnvValues: Readonly<Record<string, string>>;

  public constructor(dotEnvPath = path.join(PROJECT_ROOT, '.env')) {
    this.dotEnvValues = existsSync(dotEnvPath) ? parseDotEnv(readFileSync(dotEnvPath)) : {};
  }

  public get(name: EnvironmentVariableName): string | undefined {
    return normalize(process.env[name]) ?? normalize(this.dotEnvValues[name]);
  }
}

/** In-memory source for unit tests and programmatic runs. */
export class StaticEnvironmentSource implements EnvironmentSource {
  public constructor(
    private readonly values: Readonly<Partial<Record<EnvironmentVariableName, string>>>,
  ) {}

  public get(name: EnvironmentVariableName): string | undefined {
    return normalize(this.values[name]);
  }
}

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}
