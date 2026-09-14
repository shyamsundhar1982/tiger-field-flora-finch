import type { PoolConfig } from "pg";

export function isLoopbackPostgresConnectionString(connectionString: string): boolean {
  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Cloudflare Workers cannot reuse request-bound TCP connections in a later
 * request. Keep deployed request-scoped driver pools small and retire every
 * checked-out connection after one query; Hyperdrive provides the shared
 * cross-request pool in deployed Cloudflare environments.
 *
 * Wrangler's local Hyperdrive override resolves to a loopback PostgreSQL URL
 * instead of a multiplexing Hyperdrive proxy. In that environment, use one
 * modest bounded pool per workerd isolate. Five concurrent clients are enough
 * for VYNDI's authenticated parallel loaders while preventing the unbounded
 * direct-connection fan-out that the shared local pool is designed to avoid.
 * Local workerd still owns sockets per request, so retire each client after use
 * instead of retaining an idle socket whose creating request may have ended.
 */
export function requestSafePostgresPoolConfig(connectionString: string): PoolConfig {
  if (isLoopbackPostgresConnectionString(connectionString)) {
    return {
      connectionString,
      max: 5,
      maxUses: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    };
  }

  return {
    connectionString,
    max: 5,
    maxUses: 1,
    connectionTimeoutMillis: 10_000,
  };
}
