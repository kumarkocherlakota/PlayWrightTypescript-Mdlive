/**
 * Hosts among `targets` (URLs) that are not listed in `security.authorizedHosts`. Security
 * scenarios may run only when this is empty. Hosts are compared case-insensitively and without
 * port; an entry `*.example.test` authorizes subdomains of `example.test`, not the domain itself.
 */
export function unauthorizedHosts(
  targets: readonly string[],
  authorizedHosts: readonly string[],
): string[] {
  const allowed = authorizedHosts.map((host) => host.trim().toLowerCase());
  const hosts = [...new Set(targets.map((target) => new URL(target).hostname.toLowerCase()))];
  return hosts.filter((host) => !allowed.some((entry) => matches(host, entry)));
}

function matches(host: string, entry: string): boolean {
  return entry.startsWith('*.') ? host.endsWith(entry.slice(1)) : host === entry;
}
