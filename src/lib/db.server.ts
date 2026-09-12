import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { requestSafePostgresPoolConfig } from "./postgres-pool";
import {
  resolvePostgresTransport,
  type PostgresTransport,
} from "./postgres-runtime";
import type { Sql, SqlRow } from "./db.ts";

const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

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

let postgresTransportPromise: Promise<PostgresTransport | null> | null = null;

function getPostgresTransport(): Promise<PostgresTransport | null> {
  postgresTransportPromise ??= resolvePostgresTransport().catch((err) => {
    postgresTransportPromise = null;
    throw err;
  });
  return postgresTransportPromise;
}

function createPostgresSql(transport: PostgresTransport): Promise<Sql> {
  const connectionString = transport.connectionString;
  globalRef.__pgSqlPromise__ ??= (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool(requestSafePostgresPoolConfig(connectionString));
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
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
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

export async function getSqlServer(): Promise<Sql> {
  sqlPromise ??= (async () => {
    const transport = await getPostgresTransport();
    return transport ? createPostgresSql(transport) : createPgliteSql();
  })().catch((err) => {
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}

export async function getPgliteServer(): Promise<import("@electric-sql/pglite").PGlite> {
  const transport = await getPostgresTransport();
  if (transport) {
    throw new Error("getPglite() is only available when neither Hyperdrive nor DATABASE_URL is configured");
  }
  await getSqlServer();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

export async function ensureDbReadyServer(): Promise<void> {
  const transport = await getPostgresTransport();
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
