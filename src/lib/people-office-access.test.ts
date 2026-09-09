import test from "node:test";
import assert from "node:assert/strict";
import { canAccessRoute } from "./page-access.ts";

test("People & Office is reachable for operating finance roles", () => {
  assert.equal(canAccessRoute("admin", "/command/people-office"), true);
  assert.equal(canAccessRoute("management", "/command/people-office"), true);
  assert.equal(canAccessRoute("finance", "/command/people-office"), true);
});

test("People & Office stays restricted for read-only and unrelated roles", () => {
  assert.equal(canAccessRoute("viewer", "/command/people-office"), false);
  assert.equal(canAccessRoute("board", "/command/people-office"), false);
  assert.equal(canAccessRoute("operations", "/command/people-office"), false);
});
