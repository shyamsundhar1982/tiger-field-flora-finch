import assert from "node:assert/strict";
import test from "node:test";
import { requireArrayResponse, requireRecordResponse } from "./commercial-response-contract.ts";

test("commercial array contract accepts only arrays", () => {
  const rows = [{ id: "SO-1" }];
  assert.equal(requireArrayResponse(rows, "bad"), rows);
  for (const value of [null, {}, "orders", 1, true]) {
    assert.throws(() => requireArrayResponse(value, "invalid orders"), /invalid orders/);
  }
});

test("commercial record contract rejects null, arrays and primitives", () => {
  const record = { 1: { units: 1 } };
  assert.equal(requireRecordResponse(record, "bad"), record);
  for (const value of [null, [], "actuals", 1, false]) {
    assert.throws(() => requireRecordResponse(value, "invalid actuals"), /invalid actuals/);
  }
});
