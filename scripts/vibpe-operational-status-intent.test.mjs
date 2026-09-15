import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const operational = await readFile(new URL("../src/lib/vibpe-operational-status.ts", import.meta.url), "utf8");
const copilotUi = await readFile(new URL("../src/components/ibpe-copilot.tsx", import.meta.url), "utf8");

test("operational status is routed before generic traceability", () => {
  const governanceCall = copilotUi.indexOf("const governance = await askVibpeGovernanceCopilot");
  const operationalCall = copilotUi.indexOf("const operational = await askVibpeOperationalStatus");
  const traceabilityCall = copilotUi.indexOf("const traceability = await askTraceabilityCopilot");
  const ibpeCall = copilotUi.indexOf("const response = await askIbpeCopilot");

  assert.ok(governanceCall >= 0);
  assert.ok(operationalCall > governanceCall);
  assert.ok(traceabilityCall > operationalCall);
  assert.ok(ibpeCall > traceabilityCall);
  assert.match(copilotUi, /Governed operational status · live read-only sources/);
});

test("plain pending orders route to the commercial operational ledger", () => {
  assert.match(operational, /customerOrders/);
  assert.match(operational, /addIntent\(intents, "customer_orders"\)/);
  assert.match(operational, /Pending customer orders:/);
  assert.match(operational, /vyndi_sales_orders/);
  assert.match(operational, /delivered","closed","cancelled","canceled","void/);
});

test("supplier pending PO wording uses supplier-filtered open PO evidence", () => {
  assert.match(operational, /purchaseOrders/);
  assert.match(operational, /supplierish \? "supplier_purchase_orders" : "purchase_orders"/);
  assert.ok(operational.includes("\\boda\\b"));
  assert.match(operational, /supplierMatchScore/);
  assert.match(operational, /pending purchase orders: 0/i);
  assert.match(operational, /received\/closed\/cancelled\/void records are excluded/);
});

test("compound operational requests collect all matching intents instead of selecting one", () => {
  assert.match(operational, /interpretOperationalStatusQueries/);
  assert.match(operational, /addIntent\(intents, "customer_orders"\)/);
  assert.match(operational, /addIntent\(intents, "job_cards"\)/);
  assert.match(operational, /addIntent\(intents, supplierish \? "supplier_purchase_orders" : "purchase_orders"\)/);
  assert.match(operational, /for \(const intent of intents\)/);
  assert.match(operational, /answers\.join\("\\n\\n---\\n\\n"\)/);
  assert.match(operational, /intents,/);
});

test("pending receipt wording is treated as pending GRN receiving", () => {
  assert.match(operational, /goods\\s\+receipts\?\|receipts\?\|receiving/);
  assert.match(operational, /addIntent\(intents, "grn_pending"\)/);
  assert.match(operational, /Pending receipt \/ GRN/);
  assert.match(operational, /vyndi_goods_receipts/);
});

test("JBC GRN dispatch and invoice status phrases have dedicated live handlers", () => {
  assert.match(operational, /jbc\|job\\s\*cards/);
  assert.match(operational, /addIntent\(intents, "job_cards"\)/);
  assert.match(operational, /addIntent\(intents, "grn_pending"\)/);
  assert.match(operational, /addIntent\(intents, "dispatch_pending"\)/);
  assert.match(operational, /addIntent\(intents, "invoice_pending"\)/);
  assert.match(operational, /epr_production_job_cards/);
  assert.match(operational, /vyndi_goods_receipts/);
  assert.match(operational, /vyndi_shipments/);
  assert.match(operational, /vyndi_invoices/);
});

test("explicit document references remain traceability territory", () => {
  assert.match(operational, /hasExplicitTraceReference/);
  assert.ok(operational.includes("(?:so|jbc|po|grn|mr|batch|vyndi|autopo|vibpe-autopo)"));
  assert.match(operational, /if \(hasExplicitTraceReference\(question\)\) return \[\]/);
});

test("open PO states include both legacy and reconciled partial-receipt spellings", () => {
  for (const status of ["draft", "pending_approval", "approved", "issued", "part_received", "partially_received"]) {
    assert.ok(operational.includes(`"${status}"`), `missing open PO state ${status}`);
  }
});
