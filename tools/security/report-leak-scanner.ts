import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_REDACTION_RULES, type RedactionPattern } from '@core/security';

/** Where a report contains something the redactor should have masked. Never the value itself. */
export interface LeakFinding {
  readonly file: string;
  readonly line: number;
  /** Redaction pattern name, or `known-secret` for a value of this run's secrets. */
  readonly kind: string;
}

export interface LeakScanOptions {
  /** Secret values of this run (passwords, client secrets); found anywhere, they are a leak. */
  readonly knownSecrets?: readonly string[];
}

export interface LeakScanResult {
  readonly filesScanned: number;
  readonly findings: readonly LeakFinding[];
}

/**
 * Output that is not scanned: the generated Allure site and Cucumber HTML report bundle
 * third-party JavaScript (minified code matches assignment patterns) and re-encode the same
 * data that is scanned in the raw results; binary evidence cannot be scanned as text.
 */
const SKIPPED_DIRECTORIES = new Set(['allure-report', 'allure-history', 'traces', 'videos']);
const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson', '.xml', '.md', '.txt', '.log']);
/** Shorter values (e.g. "admin") would match ordinary text. */
const MIN_KNOWN_SECRET_LENGTH = 8;

/**
 * The redactor errs towards masking; a report scan must not cry wolf. These checks keep only
 * plausible values: an authorization header carries a real-length credential (not the words
 * "bearer token" in a step), and a card number starts with a card-network digit (2-6), is
 * written without separators or in card groups (4-4-4-4, 4-6-5), and is not part of a longer
 * identifier (UUIDs, millisecond timestamps start with 1). An assignment whose value starts with
 * the mask is masked (escaped JSON runs on after it), and an "address" ending in an artifact file
 * extension is a Playwright file name (`page@<hash>.webm`), not an e-mail address.
 */
const CARD_LAYOUT = /^(?:\d+|\d{4}([ -])\d{4}\1\d{4}\1\d{1,7}|\d{4}([ -])\d{6}\2\d{5})$/;
const IDENTIFIER_CHARACTER = /[A-Za-z0-9-]/;
const ARTIFACT_FILE = /\.(?:webm|png|jpe?g|zip|json|html?|txt|log)$/i;

type Plausibility = (match: string, preceding: string, following: string) => boolean;

const PLAUSIBLE: Readonly<Record<string, Plausibility>> = {
  'authorization-scheme': (match) => (match.split(/\s+/)[1] ?? '').length >= 16,
  'sensitive-assignment': (match) => !match.slice(match.indexOf('=') + 1).startsWith('***'),
  email: (match) => !ARTIFACT_FILE.test(match),
  'payment-card': (match, preceding, following) =>
    /^[2-6]/.test(match) &&
    CARD_LAYOUT.test(match) &&
    !IDENTIFIER_CHARACTER.test(preceding.slice(-1)) &&
    !IDENTIFIER_CHARACTER.test(following.charAt(0)),
};

/**
 * Finds unredacted sensitive values in one text, line by line, using the same patterns the
 * `Redactor` applies (JWTs, authorization headers, credential assignments, e-mail addresses,
 * SSNs, Luhn-valid card numbers), so the scanner and the logger cannot disagree.
 */
export function scanText(
  text: string,
  file: string,
  options: LeakScanOptions = {},
  patterns: readonly RedactionPattern[] = DEFAULT_REDACTION_RULES.patterns,
): LeakFinding[] {
  const secrets = (options.knownSecrets ?? []).filter(
    (secret) => secret.length >= MIN_KNOWN_SECRET_LENGTH,
  );
  const findings: LeakFinding[] = [];
  text.split('\n').forEach((content, index) => {
    const kinds = new Set<string>();
    for (const pattern of patterns) {
      const flags = pattern.regex.flags.includes('g')
        ? pattern.regex.flags
        : `${pattern.regex.flags}g`;
      for (const match of content.matchAll(new RegExp(pattern.regex.source, flags))) {
        // Unmatched optional groups are undefined at runtime despite the string[] type.
        const groups = match.slice(1).map((group: string | undefined) => group ?? '');
        const plausible = PLAUSIBLE[pattern.name] ?? (() => true);
        if (
          pattern.replace(match[0], ...groups) !== match[0] &&
          plausible(
            match[0],
            content.slice(0, match.index),
            content.slice(match.index + match[0].length),
          )
        ) {
          kinds.add(pattern.name);
        }
      }
    }
    if (secrets.some((secret) => content.includes(secret))) {
      kinds.add('known-secret');
    }
    for (const kind of kinds) {
      findings.push({ file, line: index + 1, kind });
    }
  });
  return findings;
}

/** Scans every text report under `root` (recursively) except generated sites and binaries. */
export async function scanReportDirectory(
  root: string,
  options: LeakScanOptions = {},
): Promise<LeakScanResult> {
  const files = await textReports(root);
  const findings: LeakFinding[] = [];
  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    findings.push(...scanText(await readFile(file, 'utf8'), relative, options));
  }
  return { filesScanned: files.length, findings };
}

async function textReports(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
      files.push(...(await textReports(target)));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(target);
    }
  }
  return files.sort();
}

/** One line per finding: location and kind only, so the report of a leak is not a leak. */
export function describeFindings(result: LeakScanResult): string {
  const lines = result.findings.map(
    (finding) => `${finding.file}:${finding.line}  ${finding.kind}`,
  );
  return [
    ...lines,
    `Report leak scan: ${result.filesScanned} files, ${result.findings.length} findings.`,
  ].join('\n');
}
