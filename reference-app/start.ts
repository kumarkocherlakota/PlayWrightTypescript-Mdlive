/**
 * Starts the synthetic reference app for manual exploration:
 *   npm run reference-app            (http://localhost:4000)
 *   npm run reference-app -- 4100    (custom port)
 */
import { startReferenceApp } from './server';

const port = Number(process.argv[2] ?? 4000);

startReferenceApp({ host: 'localhost', port }).then(
  (app) => {
    console.log(`Synthetic reference app running at ${app.url}/gallery (Ctrl+C to stop)`);
  },
  (error: unknown) => {
    console.error('Failed to start the reference app:', error);
    process.exitCode = 1;
  },
);
