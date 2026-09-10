/** The bearer transport exists only for the embedded Grok live preview. */
export function isBearerTransportHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host.endsWith(".grok-sandbox.com");
}
