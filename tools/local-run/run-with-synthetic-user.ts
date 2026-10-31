/**
 * Runs Cucumber against the local synthetic reference app with zero setup:
 *   node --import tsx tools/local-run/run-with-synthetic-user.ts --profile framework
 * When TEST_USER_EMAIL and TEST_USER_PASSWORD are both unset, random throwaway values are
 * generated for this run and passed only to the Cucumber child process (which also starts the
 * reference app with them). They are never printed or written to disk. Refuses any environment
 * other than `local`, so it can never invent credentials for a real system.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const env: Record<string, string | undefined> = {
  ...process.env,
  TEST_ENV: process.env.TEST_ENV ?? 'local',
};

if (env.TEST_ENV !== 'local') {
  console.error(
    `Synthetic credentials are generated only for TEST_ENV=local (got "${env.TEST_ENV}").`,
  );
  process.exit(2);
}

const hasEmail = (env.TEST_USER_EMAIL ?? '') !== '';
const hasPassword = (env.TEST_USER_PASSWORD ?? '') !== '';
if (hasEmail !== hasPassword) {
  console.error('Set both TEST_USER_EMAIL and TEST_USER_PASSWORD, or neither.');
  process.exit(2);
}
if (!hasEmail) {
  env.TEST_USER_EMAIL = `synthetic.${randomBytes(4).toString('hex')}@example.test`;
  env.TEST_USER_PASSWORD = `Syn-${randomBytes(18).toString('base64url')}!9`;
  console.log('Using a generated synthetic test user for the local reference app.');
}

const cucumberBin = path.join(
  path.dirname(require.resolve('@cucumber/cucumber/package.json')),
  'bin',
  'cucumber.js',
);
const child = spawn(process.execPath, [cucumberBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === null ? 1 : 128);
});
