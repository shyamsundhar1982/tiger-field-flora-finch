import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RUNTIME_IBPE_ENGINE_VERSION,
  runRuntimeIbpe,
} from "../src/lib/ibpe-runtime-parity.ts";

function input(overrides = {}) {
  return {
    demand: [{
      id: "M4-aluminium",
      productId: "aluminium",
      period: 4,
      planQty: 5,
      forecastQty: 5,
      committedQty: 0,
      actualQty: 0,
      confidence: 0.8,
      sourceRef: "PLAN-R1",
    }],
    bom: [{
      id: "BOM-STD-A",
      productId: "aluminium",
      revisionId: "BOM-R1",
      approved: true,
      sku: "SKU-A",
      quantityPerUnit: 1,
      sourceRef: "BOM-R1",
    }],
    inventory: [
      { sku: "SKU-A", onHandQty: 0, unitCostLakh: 0.01, leadTimeMonths: 1, moq: 1, orderMultiple: 1 },
      { sku: "SKU-OPTION", onHandQty: 0, unitCostLakh: 0.02, leadTimeMonths: 1, moq: 1, orderMultiple: 1 },
    ],
    committedMaterialRequirements: [],
    reservations: [],
    receipts: [],
    capacity: [],
    cashFlows: [],
    funding: {
      openingBankCashLakh: 10,
      minimumOperatingReserveLakh: 0,
      restrictedCashLakh: 0,
      fundraisingLeadMonths: 3,
    },
    runtimeControls: { paymentLagBySku: {} },
    ...overrides,
  };
}

test("IBPE 1.3 reconciles planned and exact committed material demand by SKU/month", () => {
  assert.equal(RUNTIME_IBPE_ENGINE_VERSION, "VYNDI-IBPE-1.3.0");
  const result = runRuntimeIbpe(input({
    committedMaterialRequirements: [
      { id: "JC-A", sku: "SKU-A", period: 4, quantity: 7, sourceRef: "JOB-CARD-A" },
      { id: "JC-OPTION", sku: "SKU-OPTION", period: 4, quantity: 2, sourceRef: "JOB-CARD-A" },
    ],
  }), { horizonMonths: 36 });

  const standard = result.supply.find((row) => row.sku === "SKU-A" && row.period === 4);
  assert.ok(standard);
  assert.equal(standard.plannedRequirementQty, 5);
  assert.equal(standard.committedRequirementQty, 7);
  assert.equal(standard.grossRequirementQty, 7, "larger exact commitment must govern without adding it to forecast demand");
  assert.equal(standard.demandBasis, "committed");

  const option = result.supply.find((row) => row.sku === "SKU-OPTION" && row.period === 4);
  assert.ok(option, "configuration-controlled committed SKU must enter the IBPE material plan");
  assert.equal(option.plannedRequirementQty, 0);
  assert.equal(option.committedRequirementQty, 2);
  assert.equal(option.grossRequirementQty, 2);
  assert.equal(option.demandBasis, "committed");
});

test("planned demand remains governing when it already covers the exact commitment", () => {
  const result = runRuntimeIbpe(input({
    committedMaterialRequirements: [
      { id: "JC-A", sku: "SKU-A", period: 4, quantity: 3, sourceRef: "JOB-CARD-A" },
    ],
  }), { horizonMonths: 36 });
  const row = result.supply.find((entry) => entry.sku === "SKU-A" && entry.period === 4);
  assert.ok(row);
  assert.equal(row.plannedRequirementQty, 5);
  assert.equal(row.committedRequirementQty, 3);
  assert.equal(row.grossRequirementQty, 5);
  assert.equal(row.demandBasis, "planned");
});

test("duplicate committed requirement IDs are rejected from aggregation and surfaced as governed findings", () => {
  const result = runRuntimeIbpe(input({
    committedMaterialRequirements: [
      { id: "JC-DUP", sku: "SKU-OPTION", period: 4, quantity: 2, sourceRef: "JOB-CARD-A" },
      { id: "JC-DUP", sku: "SKU-OPTION", period: 4, quantity: 2, sourceRef: "JOB-CARD-A" },
    ],
  }), { horizonMonths: 36 });
  const row = result.supply.find((entry) => entry.sku === "SKU-OPTION" && entry.period === 4);
  assert.ok(row);
  assert.equal(row.committedRequirementQty, 2, "a duplicate stable requirement record must not double committed demand");
  assert.ok(result.findings.some((finding) => finding.title === "Duplicate committed material requirement"));
});

test("governed authority consumes released job-card requirements and gates stale confirmed orders", async () => {
  const authority = await readFile(new URL("../src/lib/ibpe-authority.ts", import.meta.url), "utf8");
  assert.match(authority, /vyndi_committed_procurement_requirements/);
  assert.match(authority, /unsynchronized_confirmed_orders/);
  assert.match(authority, /committed-demand-projection/);
  assert.match(authority, /committedMaterialRequirements/);
  assert.match(authority, /max\(planned planning-BOM requirement, exact released job-card requirement\)/);
});

test("workspace rejects stale engine packets and Scenario Studio exposes material provenance", async () => {
  const projection = await readFile(new URL("../src/components/ibpe-workspace-projection.tsx", import.meta.url), "utf8");
  const scenarioStudio = await readFile(new URL("../src/routes/command/scenarios.tsx", import.meta.url), "utf8");
  assert.match(projection, /run\.engineVersion === IBPE_ENGINE_VERSION/);
  assert.match(scenarioStudio, /Demand basis/);
  assert.match(scenarioStudio, /plannedRequirementQty/);
  assert.match(scenarioStudio, /committedRequirementQty/);
});

test("the assistant has one canonical VIBpE Co-Pilot display name", async () => {
  const brand = await readFile(new URL("../src/lib/ibpe-brand.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/ibpe-copilot.tsx", import.meta.url), "utf8");
  const scenarioStudio = await readFile(new URL("../src/routes/command/scenarios.tsx", import.meta.url), "utf8");
  assert.match(brand, /VIBpE Co-Pilot/);
  assert.match(component, /VIBPE_COPILOT_NAME/);
  assert.match(scenarioStudio, /VIBPE_COPILOT_NAME/);
});
