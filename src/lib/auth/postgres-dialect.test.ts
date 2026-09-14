import assert from "node:assert/strict";
import test from "node:test";
import { Kysely } from "kysely";
import { requestSafePostgresDialect } from "./postgres-dialect.ts";

test("Better Auth PostgreSQL opens and closes a connection for every lookup", async () => {
  const events: string[] = [];
  let clientNumber = 0;
  const dialect = requestSafePostgresDialect("postgresql://unused.invalid/vyndi", () => {
    const id = ++clientNumber;
    return {
      async connect() {
        events.push(`connect:${id}`);
      },
      async query() {
        events.push(`query:${id}`);
        return { rows: [{ id }], rowCount: 1 };
      },
      async end() {
        events.push(`end:${id}`);
      },
    } as never;
  });
  const db = new Kysely<{ session: { id: number } }>({ dialect });

  assert.deepEqual(await db.selectFrom("session").selectAll().execute(), [{ id: 1 }]);
  assert.deepEqual(await db.selectFrom("session").selectAll().execute(), [{ id: 2 }]);
  assert.deepEqual(events, ["connect:1", "query:1", "end:1", "connect:2", "query:2", "end:2"]);

  await db.destroy();
});

test("a failed connection is closed and cannot poison the next request", async () => {
  const events: string[] = [];
  let attempt = 0;
  const dialect = requestSafePostgresDialect("postgresql://unused.invalid/vyndi", () => {
    const id = ++attempt;
    return {
      async connect() {
        events.push(`connect:${id}`);
        if (id === 1) throw new Error("request-owned socket expired");
      },
      async query() {
        events.push(`query:${id}`);
        return { rows: [{ id }], rowCount: 1 };
      },
      async end() {
        events.push(`end:${id}`);
      },
    } as never;
  });
  const db = new Kysely<{ session: { id: number } }>({ dialect });

  await assert.rejects(db.selectFrom("session").selectAll().execute(), /request-owned socket/);
  assert.deepEqual(await db.selectFrom("session").selectAll().execute(), [{ id: 2 }]);
  assert.deepEqual(events, ["connect:1", "end:1", "connect:2", "query:2", "end:2"]);

  await db.destroy();
});
