import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { ScenarioArtifacts } from '@core/artifacts';
import type { UiSession } from '@core/browser';
import type { FrameworkConfig } from '@core/config';
import { FrameworkError } from '@core/errors';
import type { ExecutionLogger, MemoryLogSink } from '@core/logging';
import type { Redactor, SecretProvider } from '@core/security';
import type { UiContext } from '@interaction/ui';
import { ScenarioContext } from './scenario-context';
import type { ScenarioInfo, ScenarioRuntime } from './scenario-runtime';
import type { ScenarioState } from './scenario-state';

export type WorldParameters = Readonly<Record<string, unknown>>;

/**
 * Scenario-scoped composition root. Cucumber requires inheriting from World; everything else is
 * composed from services built by the hooks. It exposes services, not behavior: steps call
 * domain workflows with these services.
 */
export class CustomWorld extends World<WorldParameters> {
  public readonly state = new ScenarioContext<ScenarioState>();
  private runtime: ScenarioRuntime | undefined;
  private uiSession: UiSession | undefined;

  public constructor(options: IWorldOptions<WorldParameters>) {
    super(options);
  }

  public initialize(runtime: ScenarioRuntime): void {
    if (this.runtime !== undefined) {
      throw new FrameworkError('Scenario runtime was initialized twice.');
    }
    this.runtime = runtime;
  }

  public get config(): FrameworkConfig {
    return this.requireRuntime().config;
  }

  public get scenario(): ScenarioInfo {
    return this.requireRuntime().scenario;
  }

  public get logger(): ExecutionLogger {
    return this.requireRuntime().logger;
  }

  public get logBuffer(): MemoryLogSink {
    return this.requireRuntime().logBuffer;
  }

  public get redactor(): Redactor {
    return this.requireRuntime().redactor;
  }

  public get secrets(): SecretProvider {
    return this.requireRuntime().secrets;
  }

  public get artifacts(): ScenarioArtifacts {
    return this.requireRuntime().artifacts;
  }

  public get ui(): UiSession {
    if (this.uiSession === undefined) {
      throw new FrameworkError('This scenario has no UI session. Tag the scenario with @ui.', {
        context: { scenario: this.runtime?.scenario.name },
      });
    }
    return this.uiSession;
  }

  /** Page, logger and timeouts for pages, components and workflows of this scenario. */
  public get uiContext(): UiContext {
    return {
      page: this.ui.page,
      logger: this.logger.child({ component: 'ui' }),
      expectTimeoutMs: this.config.ui.expectTimeoutMs,
    };
  }

  public get hasUiSession(): boolean {
    return this.uiSession !== undefined;
  }

  public attachUiSession(session: UiSession): void {
    if (this.uiSession !== undefined) {
      throw new FrameworkError('A UI session is already attached to this scenario.');
    }
    this.uiSession = session;
  }

  public detachUiSession(): UiSession | undefined {
    const session = this.uiSession;
    this.uiSession = undefined;
    return session;
  }

  private requireRuntime(): ScenarioRuntime {
    if (this.runtime === undefined) {
      throw new FrameworkError(
        'Scenario runtime is not initialized. The lifecycle Before hook did not run.',
      );
    }
    return this.runtime;
  }
}

setWorldConstructor(CustomWorld);
