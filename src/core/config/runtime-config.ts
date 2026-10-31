import { loadConfig } from './config-loader';
import type { FrameworkConfig } from './config-schema';

/**
 * Process-wide configuration. Loaded once per worker process and deeply frozen, so sharing it is
 * safe: it is write-once, read-only state rather than mutable global state.
 */
let activeConfig: FrameworkConfig | undefined;

export function getConfig(): FrameworkConfig {
  activeConfig ??= loadConfig();
  return activeConfig;
}
