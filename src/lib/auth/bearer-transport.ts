/**
 * Bearer transport is allowed only where first-party cookie transport is known
 * to be unreliable or unavailable: the embedded Grok preview and local loopback
 * development/acceptance hosts. Real deployed VYNDI hosts stay cookie-first.
 */
export function isBearerTransportHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return (
    host.endsWith(".grok-sandbox.com") ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}
