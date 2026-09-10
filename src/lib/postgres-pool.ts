import type { PoolConfig } from "pg";

/**
 * Cloudflare Workers cannot reuse request-bound TCP connections in a later
 * request. Retiring each checked-out pg connection also remains valid on
 * conventional Node hosts such as Vercel.
 */
export function requestSafePostgresPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    maxUses: 1,
    connectionTimeoutMillis: 10_000,
  };
}
