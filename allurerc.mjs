// Allure 3 report configuration: `npm run report:allure` / `npm run report:open`.
// Loaded with tsx registered (see package.json) so the categories reuse the TypeScript classifier.
import { defineConfig } from 'allure';
import reportPaths from './config/report-paths.json' with { type: 'json' };
import { allureCategoryRules } from './tools/failure-analysis/allure-categories.ts';

export default defineConfig({
  name: 'Universal Playwright Automation Framework',
  resultsDir: reportPaths.allureResults,
  output: reportPaths.allureReport,
  // Trend data across runs. CI restores and saves this file between runs (Phase 6).
  historyPath: reportPaths.allureHistory,
  historyLimit: 30,
  categories: { rules: allureCategoryRules() },
  plugins: {
    awesome: { options: { reportName: 'Universal Playwright Automation Framework' } },
  },
});
