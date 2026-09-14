import { getRequest } from "@tanstack/react-start/server";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import {
  isLoopbackPostgresConnectionString,
  requestSafePostgresPoolConfig,
} from "./postgres-pool";
import {
  resolvePostgresTransport,
  type PostgresTransport,
} from "./postgres-runtime";
import type { Sql, SqlRow } from "./db.ts";

const globalRef = globalThis as typeof globalThis & {
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
  __vyndiLocalPostgresPool__?: import("pg").Pool;
};

/**
 * A deployed Worker may serve many requests from the same module isolate, but
 * request-bound network I/O objects must stay inside the request that created
 * them. Keying by the ambient Request gives deployed Workers one bounded SQL
 * pool per request while allowing nested server functions in that request to
 * share it.
 *
 * Wrangler's local Hyperdrive override resolves to a loopback PostgreSQL URL,
 * not the deployed multiplexing Hyperdrive proxy. Loopback transports therefore
 * reuse one bounded pool per workerd isolate to avoid multiplying direct local
 * database connections across browser/server requests.
 */
const requestSqlCache = new WeakMap<Request, Promise<Sql>>();

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

function toSql(run: Run): Sql {
  const sql = (async <T = SqlRow>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = SqlRow>(text: string, params: unknown[] = []) => run<T>(text, params);
  return sql;
}

function isLocalPostgresTransport(transport: PostgresTransport): boolean {
  return isLoopbackPostgresConnectionString(transport.connectionString);
}

/**
 * Build a SQL facade around a bounded driver pool. Deployed Workers create this
 * per request and retire each checked-out connection after its query;
 * Hyperdrive remains the shared cross-request pool. Local Wrangler/CI reuses one
 * one-connection pool per isolate so parallel route requests cannot exhaust the
 * direct PostgreSQL server.
 */
async function createPostgresSql(transport: PostgresTransport): Promise<Sql> {
  const { Pool, types } = await import("pg");
  types.setTypeParser(OID_INT8, Number);
  types.setTypeParser(OID_DATE, identity);
  types.setTypeParser(OID_INTERVAL, identity);

  const config = requestSafePostgresPoolConfig(transport.connectionString);
  const pool = isLocalPostgresTransport(transport)
    ? (globalRef.__vyndiLocalPostgresPool__ ??= new Pool(config))
    : new Pool(config);

  return toSql(async <T>(text: string, params: unknown[]) => {
    const res = await pool.query(text, params);
    return res.rows as T[];
  });
}

async function createPgliteSql(): Promise<Sql> {
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>("select name from _migrations");
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined)
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows as T[];
  });
}

export async function getSqlServer(): Promise<Sql> {
  const transport = await resolvePostgresTransport();
  if (!transport) return createPgliteSql();

  // Local Hyperdrive overrides surface as a loopback HYPERDRIVE connection
  // string inside workerd. Reuse the per-isolate bounded pool in that runtime.
  if (isLocalPostgresTransport(transport)) return createPostgresSql(transport);

  // In deployed Workers, getRequest() is stable for nested server functions in
  // the same incoming request and prevents cross-request I/O reuse.
  const request = getRequest();
  if (!request) return createPostgresSql(transport);

  const cached = requestSqlCache.get(request);
  if (cached) return cached;

  const pending = createPostgresSql(transport).catch((error) => {
    requestSqlCache.delete(request);
    throw error;
  });
  requestSqlCache.set(request, pending);
  return pending;
}

export async function getPgliteServer(): Promise<import("@electric-sql/pglite").PGlite> {
  const transport = await resolvePostgresTransport();
  if (transport) {
    throw new Error("getPglite() is only available when neither Hyperdrive nor DATABASE_URL is configured");
  }
  await getSqlServer();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

export async function ensureDbReadyServer(): Promise<void> {
  const transport = await resolvePostgresTransport();
  if (transport) return;
  await getSqlServer();
}

const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
globalBoot.__pgBootstrapPromise__ ??= ensureDbReadyServer().catch((err) => {
  globalBoot.__pgBootstrapPromise__ = undefined;
  console.error("[db] bootstrap failed:", err);
  throw err;
});
