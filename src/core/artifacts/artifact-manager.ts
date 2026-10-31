import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const ARTIFACT_KINDS = [
  'screenshots',
  'traces',
  'videos',
  'logs',
  'api',
  'accessibility',
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface ScenarioIdentity {
  readonly name: string;
  /** Stable identifier of the scenario (Cucumber pickle id). */
  readonly id: string;
  readonly attempt: number;
}

const MAX_SLUG_LENGTH = 60;

/** Owns the artifact directory layout under the configured output directory. */
export class ArtifactManager {
  public constructor(private readonly rootDirectory: string) {}

  public get root(): string {
    return this.rootDirectory;
  }

  public directory(kind: ArtifactKind): string {
    const directory = path.join(this.rootDirectory, kind);
    mkdirSync(directory, { recursive: true });
    return directory;
  }

  public forScenario(identity: ScenarioIdentity): ScenarioArtifacts {
    return new ScenarioArtifacts(this, scenarioKey(identity));
  }
}

/** Collision-free artifact paths for one scenario attempt; safe under parallel workers. */
export class ScenarioArtifacts {
  public constructor(
    private readonly manager: ArtifactManager,
    public readonly key: string,
  ) {}

  public pathFor(kind: ArtifactKind, extension: string, label?: string): string {
    const suffix = label === undefined ? '' : `-${slugify(label)}`;
    return path.join(this.manager.directory(kind), `${this.key}${suffix}.${extension}`);
  }

  public directoryFor(kind: ArtifactKind): string {
    const directory = path.join(this.manager.directory(kind), this.key);
    mkdirSync(directory, { recursive: true });
    return directory;
  }
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
  return slug === '' ? 'unnamed' : slug;
}

function scenarioKey(identity: ScenarioIdentity): string {
  const hash = createHash('sha256').update(identity.id).digest('hex').slice(0, 8);
  return `${slugify(identity.name)}-${hash}-attempt${identity.attempt}`;
}
