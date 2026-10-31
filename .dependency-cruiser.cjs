/**
 * Architecture boundaries (see docs/architecture/ARCHITECTURE.md, section 4).
 * Run with: npm run arch:check
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'RULE-016: circular dependencies are forbidden.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-is-the-foundation',
      comment: 'Framework core must not depend on interaction, domain or BDD layers.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/(interaction|domains|bdd)/' },
    },
    {
      name: 'interaction-below-domains',
      comment: 'Generic UI/API primitives must not depend on domains or the BDD layer.',
      severity: 'error',
      from: { path: '^src/interaction/' },
      to: { path: '^src/(domains|bdd)/' },
    },
    {
      name: 'domains-below-bdd',
      comment: 'Domains (pages, API clients, workflows) must not depend on steps, hooks or World.',
      severity: 'error',
      from: { path: '^src/domains/' },
      to: { path: '^src/bdd/' },
    },
    {
      name: 'runner-independence',
      comment: 'ADR-002: only the BDD layer may depend on Cucumber.',
      severity: 'error',
      from: { path: '^src/(core|interaction|domains)/' },
      to: { path: '@cucumber/' },
    },
    {
      name: 'domain-public-contract',
      comment: 'RULE-018: other domains may import only from a domain public index.ts.',
      severity: 'error',
      from: { path: '^src/domains/([^/]+)/' },
      to: {
        path: '^src/domains/[^/]+/',
        pathNot: ['^src/domains/$1/', '^src/domains/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'bdd-uses-domain-public-contract',
      comment: 'RULE-018: steps and hooks import domains only through their public index.ts.',
      severity: 'error',
      from: { path: '^src/bdd/' },
      to: { path: '^src/domains/[^/]+/', pathNot: '^src/domains/[^/]+/index\\.ts$' },
    },
    {
      name: 'steps-do-not-drive-browsers',
      comment: 'RULE-001: steps must not import browser lifecycle or interaction primitives.',
      severity: 'error',
      from: { path: '^src/bdd/steps/' },
      to: { path: '^src/(core/browser|interaction)/' },
    },
    {
      name: 'no-dumping-ground-modules',
      comment: 'RULE-014: generic utils/helpers/common modules are not allowed.',
      severity: 'error',
      from: {},
      to: { path: '(^|/)(utils?|helpers?|common|misc)(\\.ts|/)' },
    },
    {
      name: 'reference-app-is-standalone',
      comment: 'The synthetic reference app must not depend on framework code.',
      severity: 'error',
      from: { path: '^reference-app/' },
      to: { path: '^src/' },
    },
    {
      name: 'reference-app-only-from-hooks',
      comment: 'Only BDD hooks may start the reference app; tests must reach it over HTTP.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/bdd/hooks/' },
      to: { path: '^reference-app/' },
    },
    {
      name: 'tools-stay-outside-runtime',
      comment: 'Framework runtime code must not depend on developer tools.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^tools/' },
    },
    {
      name: 'production-code-not-to-tests',
      comment: 'Framework code must not depend on unit tests.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^tests/' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
