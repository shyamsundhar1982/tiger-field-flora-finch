import test from "node:test";
import assert from "node:assert/strict";
import { isExplicitAdvancedOptimizationRequest } from "./advanced-optimization-vibpe-action.ts";

test("requires explicit optimization plus execution intent", () => {
  assert.equal(isExplicitAdvancedOptimizationRequest("run the optimizer now"), true);
  assert.equal(isExplicitAdvancedOptimizationRequest("execute HiGHS optimization"), true);
  assert.equal(isExplicitAdvancedOptimizationRequest("compute MILP optimization"), true);
  assert.equal(isExplicitAdvancedOptimizationRequest("what does optimization mean?"), false);
  assert.equal(isExplicitAdvancedOptimizationRequest("show advanced planning evidence"), false);
  assert.equal(isExplicitAdvancedOptimizationRequest("run today's report"), false);
});
