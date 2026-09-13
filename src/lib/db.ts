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

async function syncCloudflareRuntimeEnv(): Promise<void> {
  try {
    // Cloudflare Worker bindings live on cloudflare:workers `env`, while some
    // governance code intentionally reads deployment metadata from process.env
    // for Vercel/Node portability. Bridge only the explicit source-SHA binding.
    const cloudflareWorkersModule = "cloudflare:workers";
    const workers = await import(/* @vite-ignore */ cloudflareWorkersModule);
    const runtimeEnv = workers.env as Record<string, unknown> | undefined;
    const runtimeSha = typeof runtimeEnv?.VYNDI_SOURCE_SHA === "string"
      ? runtimeEnv.VYNDI_SOURCE_SHA.trim()
      : "";
    if (runtimeSha.length >= 7 && typeof process !== "undefined") {
      process.env.VYNDI_SOURCE_SHA = runtimeSha;
    }
  } catch {
    // Outside Cloudflare Workers the platform module is intentionally absent.
  }
}

/**
 * Server-only database trampoline. TanStack replaces this implementation in the
 * client bundle, so `pg`, PGLite, migration SQL and database environment state
 * never need to enter the browser dependency graph.
 */
export const getSql = createServerOnlyFn(async (): Promise<Sql> => {
  await syncCloudflareRuntimeEnv();
  const { getSqlServer } = await import("./db.server.ts");
  return getSqlServer();
});

/** Shared embedded Postgres instance for local/preview fallback only. */
export const getPglite = createServerOnlyFn(async (): Promise<PGlite> => {
  await syncCloudflareRuntimeEnv();
  const { getPgliteServer } = await import("./db.server.ts");
  return getPgliteServer();
});

/** Finish local PGLite bootstrap before preview traffic is accepted. */
export const ensureDbReady = createServerOnlyFn(async (): Promise<void> => {
  await syncCloudflareRuntimeEnv();
  const { ensureDbReadyServer } = await import("./db.server.ts");
  return ensureDbReadyServer();
});
