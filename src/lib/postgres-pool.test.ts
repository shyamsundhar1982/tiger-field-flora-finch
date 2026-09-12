import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { requestSafePostgresPoolConfig } from "./postgres-pool.ts";
import { selectPostgresTransport } from "./postgres-runtime.ts";

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

test("Hyperdrive takes precedence over direct DATABASE_URL", () => {
  assert.deepEqual(
    selectPostgresTransport({
      hyperdriveConnectionString: "postgresql://hyperdrive.internal/vyndi",
      databaseUrl: "postgresql://neon.example/vyndi",
    }),
    {
      source: "hyperdrive",
      connectionString: "postgresql://hyperdrive.internal/vyndi",
    },
  );
});

test("DATABASE_URL remains the portable fallback when Hyperdrive is absent", () => {
  assert.deepEqual(
    selectPostgresTransport({ databaseUrl: " postgresql://neon.example/vyndi " }),
    {
      source: "database-url",
      connectionString: "postgresql://neon.example/vyndi",
    },
  );
});

test("blank deployed database candidates preserve the local PGLite fallback", () => {
  assert.equal(
    selectPostgresTransport({
      hyperdriveConnectionString: "   ",
      databaseUrl: "\n",
    }),
    null,
  );
});
