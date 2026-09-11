import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("shared controlled transaction document renderer preserves electronic authority", async () => {
  const renderer = await text("src/lib/controlled-document.ts");
  assert.match(renderer, /Vāyú Shastr Pvt Ltd · Controlled Business Record/);
  assert.match(renderer, /Electronic VYNDI system record is authoritative/);
  assert.match(renderer, /Printed copy is uncontrolled unless specifically issued as a controlled copy/);
  assert.match(renderer, /A4 \$\{orientation\}/);
  assert.match(renderer, /Digital thread \/ lineage/);
});

test("respective transaction workspaces expose canonical controlled document types", async () => {
  const toolbar = await text("src/components/controlled-document-toolbar.tsx");
  const route = await text("src/routes/command/route.tsx");

  for (const pathname of [
    "/command/sales",
    "/command/production",
    "/command/purchase-execution",
    "/command/receiving",
    "/command/quality",
    "/command/operations",
    "/command/receivables",
  ]) {
    assert.match(toolbar, new RegExp(pathname.replaceAll("/", "\\/")));
  }

  for (const label of [
    "Commercial Demand / Order",
    "Production Job Card",
    "Traveller Card / Serial Genealogy",
    "Material Requisition & Issue Record",
    "Purchase Order",
    "Goods Receipt Note / Incoming Inspection",
    "Serialized Quality Release",
    "Dispatch / Shipment Record",
    "Customer Invoice / Receivable Record",
    "End-to-End Demand-to-Cash Digital Thread",
  ]) {
    assert.ok(toolbar.includes(label), `${label} controlled document must remain available`);
  }

  assert.match(route, /ControlledDocumentToolbar/);
  assert.match(route, /<ControlledDocumentToolbar \/>/);
});

test("end-to-end print uses canonical persisted lineage and never invents pending stages", async () => {
  const toolbar = await text("src/components/controlled-document-toolbar.tsx");

  for (const source of [
    "getOperatingLineage",
    "listQualityAuthority",
    "listDispatchRegister",
    "listShipmentRevenueLedger",
    "getPurchaseExecutionData",
    "getReceivingData",
    "getProductionJobCardView",
    "listSalesOrders",
  ]) {
    assert.match(toolbar, new RegExp(source));
  }

  for (const stage of [
    "Demand / Commercial Order",
    "Production Job Card",
    "Material Requirement",
    "Procurement / PO",
    "Receiving / GRN",
    "Traveller / Genealogy",
    "Quality Release",
    "Dispatch",
    "Invoice",
    "Collection",
  ]) {
    assert.ok(toolbar.includes(stage), `${stage} must remain in the digital-thread print`);
  }

  assert.match(toolbar, /A stage is shown as pending when no persisted canonical record exists/);
  assert.doesNotMatch(toolbar, /planning data.*complete/i);
});
