#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).");
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
// Both Cloudflare and Vercel deploy from the same push and target the same
// database. Hold one database-scoped session lock across discovery + apply so
// concurrent provider builds cannot race CREATE TABLE / _migrations writes.
const migrationLock = [1982, 1505];

async function collectSqlFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await collectSqlFiles(join(dir, entry.name), `${prefix}${entry.name}/`)));
    } else {
      files.push(`${prefix}${entry.name}`);
    }
  }
  return files;
}

async function main() {
  let entries;
  try {
    entries = await collectSqlFiles(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }

  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1, $2)", migrationLock);
    locked = true;
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name);

    let count = 0;
    for (const { name, path } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, path), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${path}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original migration error if rollback also fails.
        }
        throw err;
      }
      console.log(`[migrate] applied ${path}`);
      count += 1;
    }

    console.log(
      count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.",
    );
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1, $2)", migrationLock);
      } catch {
        // The connection is released below, which also releases the session lock.
      }
    }
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  process.exit(1);
});
