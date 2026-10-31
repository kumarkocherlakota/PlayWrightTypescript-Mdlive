// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PROCESS_ENV_RESTRICTION = {
  object: 'process',
  property: 'env',
  message:
    'Read configuration through @core/config. Only src/core/config/environment-source.ts may access process.env (ADR-009).',
};

const FIXED_WAIT_RESTRICTION = {
  selector: "CallExpression[callee.property.name='waitForTimeout']",
  message:
    'Fixed waits are forbidden (RULE-006). Use web-first assertions, waitForResponse, waitForURL or polling.',
};

export default defineConfig(
  globalIgnores([
    'node_modules/',
    'reports/',
    'allure-results/',
    'allure-report/',
    'test-results/',
    'playwright-report/',
  ]),

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['reference-app/public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },

  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'no-restricted-properties': ['error', PROCESS_ENV_RESTRICTION],
      'no-restricted-syntax': ['error', FIXED_WAIT_RESTRICTION],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },

  // The single sanctioned reader of process.env.
  {
    files: ['src/core/config/environment-source.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  // Console output is allowed only in the console log sink, CLI tools and the reference app.
  {
    files: ['src/core/logging/sinks/console-log-sink.ts', 'tools/**/*.ts', 'reference-app/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  // The reference app is a standalone synthetic server and reads its own process arguments.
  // The test runner prepares the environment of a child process before any framework code runs.
  {
    files: ['reference-app/**/*.ts', 'tools/run/run-cucumber.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  // RULE-013 / ADR-005: locator hierarchy in Page and Component Objects.
  {
    files: [
      'src/domains/**/pages/**/*.ts',
      'src/domains/**/components/**/*.ts',
      'src/interaction/ui/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        FIXED_WAIT_RESTRICTION,
        {
          selector:
            'CallExpression[callee.property.name=/^(first|last|nth)$/][arguments.length<=1]',
          message:
            'Positional locators need a justification (RULE-013). Prefer a unique role/label locator, or add "// eslint-disable-next-line no-restricted-syntax -- <reason>".',
        },
        {
          selector:
            "CallExpression[callee.property.name='locator'] > Literal[value=/^(\\/\\/|xpath=|\\.\\.|\\(\\/\\/)/]",
          message:
            'XPath is the last-resort locator (RULE-013). Use getByRole/getByLabel/getByTestId, or justify with an eslint-disable comment.',
        },
        {
          selector:
            "CallExpression[callee.property.name='locator'] > Literal[value=/(#[A-Za-z_-]*\\d{3,}|\\.(css|sc|jsx|emotion)-[A-Za-z0-9]|\\[class[*^$]?=|(\\s*>\\s*[^>]+){3,})/]",
          message:
            'Avoid dynamic IDs, generated class names and long CSS chains (RULE-013). Use a user-facing locator or data-testid.',
        },
        {
          selector: "CallExpression[callee.property.name='waitForSelector']",
          message: 'Use locator.waitFor() or a web-first assertion instead of waitForSelector.',
        },
      ],
    },
  },

  // RULE-001 / RULE-004: step definitions stay thin and never touch Playwright or HTTP directly.
  {
    files: ['src/bdd/steps/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              allowImportNames: ['expect'],
              message: 'Steps may only import expect from @playwright/test. Delegate to workflows.',
            },
            { name: 'playwright', message: 'Steps must delegate UI work to workflows.' },
            { name: 'playwright-core', message: 'Steps must delegate UI work to workflows.' },
          ],
          patterns: [
            {
              group: ['@core/browser', '@core/browser/*', '@interaction/*'],
              message: 'Steps must use domain workflows, not interaction or browser internals.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        FIXED_WAIT_RESTRICTION,
        {
          selector:
            'CallExpression[callee.property.name=/^(locator|getByRole|getByLabel|getByText|getByTestId|getByPlaceholder|getByAltText|getByTitle|waitForSelector|\\$|\\$\\$)$/]',
          message: 'Locators belong in Page/Component Objects (RULE-001, RULE-013).',
        },
      ],
      'max-lines-per-function': ['error', { max: 20, skipBlankLines: true, skipComments: true }],
    },
  },

  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', package: 'node:test', name: ['describe', 'it', 'test', 'suite'] },
          ],
        },
      ],
      'max-lines': 'off',
    },
  },

  prettier,
);
