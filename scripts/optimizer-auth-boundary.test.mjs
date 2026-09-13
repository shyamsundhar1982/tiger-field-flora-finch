import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("governed optimizer mutation carries the verified auth identity into execution", async () => {
  const execution = await source("src/lib/advanced-optimizer-execution.ts");
  const serverFn = execution.indexOf("export const runAdvancedOptimizerFromPacket");
  const middleware = execution.indexOf(".middleware([authMiddleware])", serverFn);
  const handler = execution.indexOf(".handler(async ({ data, context })", serverFn);
  const actor = execution.indexOf('requireBusinessActor("edit", {', handler);

  assert.match(execution, /import \{ authMiddleware \} from "\.\/auth\/middleware\.ts";/);
  assert.ok(serverFn >= 0, "governed optimizer server function is missing");
  assert.ok(middleware > serverFn, "optimizer mutation must use required auth middleware");
  assert.ok(handler > middleware, "verified auth context must reach the optimizer handler");
  assert.ok(actor > handler, "optimizer actor must be derived from the middleware-verified identity");
  assert.match(execution.slice(actor, actor + 180), /userId: context\.userId/);
  assert.match(execution.slice(actor, actor + 180), /email: context\.userEmail/);
  assert.doesNotMatch(execution.slice(handler, actor + 180), /requireBusinessActor\("edit"\);/);
});
