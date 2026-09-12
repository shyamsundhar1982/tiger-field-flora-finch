import { createServerOnlyFn } from "@tanstack/react-start";
import type { PGlite } from "@electric-sql/pglite";

/** Which database backend is active on the server. */
export type DbSource = "neon" | "pglite";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type SqlRow = Record<string, JsonValue>;

/**
 * Minimal shared SQL surface. This interface is client-safe; the actual pg/PGLite
 * implementation lives exclusively in `db.server.ts`.
 */
export interface Sql {
  <T = SqlRow>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = SqlRow>(text: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Server-only database trampoline. TanStack replaces this implementation in the
 * client bundle, so `pg`, PGLite, migration SQL and database environment state
 * never need to enter the browser dependency graph.
 */
export const getSql = createServerOnlyFn(async (): Promise<Sql> => {
  const { getSqlServer } = await import("./db.server.ts");
  return getSqlServer();
});

/** Shared embedded Postgres instance for local/preview fallback only. */
export const getPglite = createServerOnlyFn(async (): Promise<PGlite> => {
  const { getPgliteServer } = await import("./db.server.ts");
  return getPgliteServer();
});

/** Finish local PGLite bootstrap before preview traffic is accepted. */
export const ensureDbReady = createServerOnlyFn(async (): Promise<void> => {
  const { ensureDbReadyServer } = await import("./db.server.ts");
  return ensureDbReadyServer();
});
