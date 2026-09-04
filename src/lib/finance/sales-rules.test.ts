import assert from "node:assert/strict";
import test from "node:test";
import { isOrderBookStatus, isRevenueStatus } from "./sales-rules.ts";

test("sales lifecycle keeps leads out of booked orders and revenue", () => {
  assert.equal(isOrderBookStatus("lead"), false);
  assert.equal(isRevenueStatus("lead"), false);
  assert.equal(isOrderBookStatus("confirmed"), true);
  assert.equal(isRevenueStatus("confirmed"), false);
  assert.equal(isOrderBookStatus("delivered"), true);
  assert.equal(isRevenueStatus("delivered"), true);
  assert.equal(isOrderBookStatus("cancelled"), false);
  assert.equal(isRevenueStatus("cancelled"), false);
});
