import assert from "node:assert/strict";
import test from "node:test";
import { approvedDecisionImpact, getForecast, governanceScore, PHASE5_GOVERNANCE } from "../src/lib/operations/phase5.ts";
test("Phase 5 management OS keeps venture forecasts explicit", () => { assert.equal(getForecast("carbon").venture, "carbon"); assert.equal(getForecast("aluminium").venture, "aluminium"); assert.equal(getForecast("consolidated").venture, "consolidated"); });
test("Phase 5 scenario engine changes forecast envelope", () => { assert.ok(getForecast("carbon", "upside").revenueInr > getForecast("carbon", "base").revenueInr); assert.ok(getForecast("carbon", "downside").revenueInr < getForecast("carbon", "base").revenueInr); });
test("Phase 5 governance score and approval impact are deterministic", () => { assert.equal(governanceScore(PHASE5_GOVERNANCE), 60); assert.equal(approvedDecisionImpact([{ id: "x", title: "x", owner: "x", impactInr: 100, status: "approved" }]), 100); });
