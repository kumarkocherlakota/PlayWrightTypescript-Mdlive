// Cucumber runner configuration (infrastructure layer).
// Runner-level switches (CI retries, worker count, tag filter) are read here because Cucumber
// evaluates this file before any framework code loads. All other settings come from
// src/core/config.

const isCI = process.env.CI === 'true';
const retries = isCI ? Number(process.env.RETRIES ?? 2) : 0;
const workers = Number(process.env.PARALLEL_WORKERS ?? 0);

/** @type {import('@cucumber/cucumber').IConfiguration} */
const base = {
  paths: ['features/**/*.feature'],
  requireModule: ['tsx/cjs'],
  require: ['src/bdd/**/*.ts'],
  format: [
    'progress',
    'html:reports/cucumber/cucumber-report.html',
    'json:reports/cucumber/cucumber-report.json',
    'junit:reports/junit/junit.xml',
  ],
  formatOptions: {
    snippetInterface: 'async-await',
    junit: { suiteName: 'universal-playwright-automation-framework' },
  },
  strict: true,
  retry: retries,
  parallel: workers,
  tags: process.env.TAGS ?? 'not @wip',
};

export default base;

export const framework = { ...base, tags: '@framework and not @wip' };
export const smoke = { ...base, tags: '@smoke and not @wip' };
export const regression = { ...base, tags: '@regression and not @wip' };
export const ui = { ...base, tags: '@ui and not @wip' };
export const api = { ...base, tags: '@api and not @wip' };

// Quality gate: fails on undefined or ambiguous steps without executing anything.
export const dryRun = { ...base, dryRun: true, format: ['progress'], tags: '' };

// Lists step definitions and their usage; unused definitions are reported as UNUSED.
export const usage = { ...base, dryRun: true, format: ['usage'], tags: '' };

// Machine-readable usage for the unused-step gate (tools/bdd/unused-steps.ts).
export const usageJson = {
  ...base,
  dryRun: true,
  format: ['usage-json:reports/bdd/usage.json'],
  tags: '',
};
