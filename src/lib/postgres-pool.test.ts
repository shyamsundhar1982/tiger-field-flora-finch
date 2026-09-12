import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { requestSafePostgresPoolConfig } from "./postgres-pool.ts";

test("deployed PostgreSQL connections cannot be reused across Worker requests", async () => {
  const config = requestSafePostgresPoolConfig("postgresql://example.invalid/db");

  assert.equal(config.connectionString, "postgresql://example.invalid/db");
  assert.equal(config.maxUses, 1);
  assert.equal(config.connectionTimeoutMillis, 10_000);

  const [databaseSource, authSource] = await Promise.all([
    readFile(new URL("./db.server.ts", import.meta.url), "utf8"),
    readFile(new URL("./auth/server.ts", import.meta.url), "utf8"),
  ]);

  assert.match(databaseSource, /new Pool\(requestSafePostgresPoolConfig\([^)]+\)\)/);
  assert.match(authSource, /new Pool\(requestSafePostgresPoolConfig\([^)]+\)\)/);
});
