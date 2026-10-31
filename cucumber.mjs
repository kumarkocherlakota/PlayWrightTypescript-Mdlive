// Cucumber runner configuration (infrastructure layer).
// Runner-level switches (CI retries, worker count, tag filter) are read here because Cucumber
// evaluates this file before any framework code loads. All other settings come from
// src/core/config.
import reportPaths from './config/report-paths.json' with { type: 'json' };

const isCI = process.env.CI === 'true';
const retries = isCI ? Number(process.env.RETRIES ?? 2) : 0;
const workers = Number(process.env.PARALLEL_WORKERS ?? 0);
const unset = 'not set (configuration default)';
// Manual and blocked scenarios document coverage for traceability; they are never executed.
const runnable = 'not @wip and not @manual and not @blocked';

/** @type {import('@cucumber/cucumber').IConfiguration} */
const base = {
  paths: ['features/**/*.feature'],
  requireModule: ['tsx/cjs'],
  require: ['src/bdd/**/*.ts'],
  format: [
    'progress',
    `html:${reportPaths.cucumberHtml}`,
    `json:${reportPaths.cucumberJson}`,
    `junit:${reportPaths.junit}`,
    // Raw event stream: input for the failure analysis (tools/failure-analysis).
    `message:${reportPaths.cucumberMessages}`,
    // Writes into resultsDir; its own stream gets a file so `progress` keeps stdout.
    `allure-cucumberjs/reporter:${reportPaths.allureFormatterOutput}`,
  ],
  formatOptions: {
    snippetInterface: 'async-await',
    junit: { suiteName: 'universal-playwright-automation-framework' },
    resultsDir: reportPaths.allureResults,
    // Run metadata only; never put credentials or hostnames carrying tokens here.
    environmentInfo: {
      environment: process.env.TEST_ENV ?? unset,
      browser: process.env.BROWSER ?? unset,
      workers: String(workers),
      retries: String(retries),
      ci: String(isCI),
    },
  },
  strict: true,
  retry: retries,
  parallel: workers,
  tags: process.env.TAGS ?? runnable,
};

export default base;

export const framework = { ...base, tags: `@framework and ${runnable}` };
export const healthcare = { ...base, tags: `@healthcare and ${runnable}` };
export const smoke = { ...base, tags: `@smoke and ${runnable}` };
export const regression = { ...base, tags: `@regression and ${runnable}` };
export const ui = { ...base, tags: `@ui and ${runnable}` };
export const api = { ...base, tags: `@api and ${runnable}` };
export const integration = { ...base, tags: `@integration and ${runnable}` };

// Quality gate: fails on undefined or ambiguous steps without executing anything.
// Manual and blocked scenarios have no step definitions by design.
const automated = 'not @manual and not @blocked';
export const dryRun = { ...base, dryRun: true, format: ['progress'], tags: automated };

// Lists step definitions and their usage; unused definitions are reported as UNUSED.
export const usage = { ...base, dryRun: true, format: ['usage'], tags: automated };

// Machine-readable usage for the unused-step gate (tools/bdd/unused-steps.ts).
export const usageJson = {
  ...base,
  dryRun: true,
  format: ['usage-json:reports/bdd/usage.json'],
  tags: automated,
};
