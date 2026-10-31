import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ConfigurationError } from '@core/errors';
import { CONFIG_DEFAULTS, DEFAULT_ENVIRONMENT } from './config-defaults';
import { frameworkConfigSchema, type FrameworkConfig } from './config-schema';
import { deepFreeze, deepMerge, isPlainObject, type PlainObject } from './deep-merge';
import type { DeepPartial } from './deep-partial';
import { readEnvironmentOverrides } from './environment-overrides';
import { ProcessEnvironmentSource, type EnvironmentSource } from './environment-source';
import { PROJECT_ROOT } from './project-root';

export interface LoadConfigOptions {
  readonly source?: EnvironmentSource;
  /** Highest-precedence layer, for programmatic runs and tests. */
  readonly overrides?: DeepPartial<FrameworkConfig>;
  readonly configDirectory?: string;
}

const ENVIRONMENT_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * Builds the configuration with precedence:
 * defaults → config/environments/<env>.json → environment variables → runtime overrides.
 * The result is validated, deeply frozen, and fails fast with a ConfigurationError.
 */
export function loadConfig(options: LoadConfigOptions = {}): FrameworkConfig {
  const source = options.source ?? new ProcessEnvironmentSource();
  const configDirectory = resolveConfigDirectory(options.configDirectory, source);
  const environment =
    options.overrides?.environment ?? source.get('TEST_ENV') ?? DEFAULT_ENVIRONMENT;

  const merged = deepMerge(
    CONFIG_DEFAULTS,
    { environment, runId: generateRunId() },
    readEnvironmentFile(configDirectory, environment),
    readEnvironmentOverrides(source),
    options.overrides,
  );

  const parsed = frameworkConfigSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new ConfigurationError(
      `Invalid configuration for environment "${environment}":\n${issues.join('\n')}`,
      { context: { environment, issues: issues.length } },
    );
  }
  return deepFreeze(parsed.data);
}

function resolveConfigDirectory(explicit: string | undefined, source: EnvironmentSource): string {
  const directory = explicit ?? source.get('CONFIG_DIR') ?? 'config/environments';
  return path.isAbsolute(directory) ? directory : path.join(PROJECT_ROOT, directory);
}

function readEnvironmentFile(directory: string, environment: string): PlainObject {
  if (!ENVIRONMENT_NAME.test(environment)) {
    throw new ConfigurationError(`Environment name "${environment}" is not valid.`, {
      context: { environment },
    });
  }
  const file = path.join(directory, `${environment}.json`);
  if (!existsSync(file)) {
    throw new ConfigurationError(
      `Unknown environment "${environment}". Available: ${listEnvironments(directory).join(', ')}.`,
      { context: { environment, directory } },
    );
  }

  let content: unknown;
  try {
    content = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ConfigurationError(`Environment file ${file} is not valid JSON.`, { cause: error });
  }
  if (!isPlainObject(content)) {
    throw new ConfigurationError(`Environment file ${file} must contain a JSON object.`);
  }
  return content;
}

function listEnvironments(directory: string): string[] {
  return existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace(/\.json$/, ''))
    : [];
}

function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  return `${timestamp}-${randomBytes(3).toString('hex')}`;
}
