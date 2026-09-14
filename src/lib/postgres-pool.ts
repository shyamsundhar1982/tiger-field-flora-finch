import type { PoolConfig } from "pg";

/**
 * Cloudflare Workers cannot reuse request-bound TCP connections in a later
 * request. Keep each request-scoped driver pool small and retire every
 * checked-out connection after one query; Hyperdrive provides the shared
 * cross-request pool in deployed Cloudflare environments.
 */
export function requestSafePostgresPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: 5,
    maxUses: 1,
    connectionTimeoutMillis: 10_000,
  };
}
