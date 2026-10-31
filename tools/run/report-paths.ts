import reportPaths from '../../config/report-paths.json';

/** Report locations relative to the project root; shared with cucumber.mjs and allurerc.mjs. */
export const REPORT_PATHS: Readonly<typeof reportPaths> = reportPaths;
