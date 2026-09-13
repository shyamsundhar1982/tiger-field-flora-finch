import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const server = fs.readFileSync(new URL("../src/lib/vibpe-governance-server.ts", import.meta.url), "utf8");
const priority = fs.readFileSync(new URL("../src/lib/vibpe-operational-control-priority.ts", import.meta.url), "utf8");
const completion = fs.readFileSync(new URL("../src/lib/vibpe-operational-control-completion.ts", import.meta.url), "utf8");
const audit = fs.readFileSync(new URL("../src/lib/vibpe-operational-control-audit.ts", import.meta.url), "utf8");

test("exact operational controls fail closed before generic planning/governance fallbacks", () => {
  assert.match(server, /tryVibpePriorityOperationalControl/);
  assert.match(server, /tryVibpeOperationalControlCompletion/);
  assert.match(server, /tryVibpeOperationalControlAudit/);
  assert.match(server, /Exact operational-control answer: NOT VERIFIED/);
  assert.match(server, /will not substitute a planning summary, traceability lookup, knowledge-pack excerpt, or generic recommendation/);

  const priorityCall = server.indexOf("await tryVibpePriorityOperationalControl");
  const completionCall = server.indexOf("await tryVibpeOperationalControlCompletion");
  const auditCall = server.indexOf("await tryVibpeOperationalControlAudit");
  const exactGuard = server.lastIndexOf("isExactOperationalControlQuestion(question)");
  const optimizerCall = server.indexOf("await answerGovernedOptimizerExecutionRequest");
  const specialistCall = server.indexOf("await tryVibpeLiveSpecialistAnswer");
  const governanceCall = server.indexOf("await tryGovernanceDataAnswer");

  assert.ok(priorityCall >= 0);
  assert.ok(completionCall > priorityCall);
  assert.ok(auditCall > completionCall);
  assert.ok(exactGuard > auditCall);
  assert.ok(optimizerCall > exactGuard, "unsupported exact controls must not reach generic optimizer reasoning");
  assert.ok(specialistCall > optimizerCall);
  assert.ok(governanceCall > specialistCall);
});

test("priority P0 audit failures retain direct governed handlers", () => {
  for (const evidence of [
    "Confirmed customer demand:",
    "Confirmed-order job-card coverage: PASS",
    "Exact confirmed-order shortage check: BLOCKED",
    "Draft-PO lineage:",
    "Draft-PO supplier assignment: FAIL",
    "Supplier ${label}-rating completeness: FAIL",
  ]) assert.ok(priority.includes(evidence), `missing priority control evidence: ${evidence}`);

  assert.match(priority, /vyndi_sales_orders/);
  assert.match(priority, /epr_production_job_cards/);
  assert.match(priority, /vyndi_live_job_card_requirements/);
  assert.match(priority, /vyndi_purchase_orders/);
  assert.match(priority, /vyndi_suppliers/);
});

test("completion handlers cover the formerly unresolved audit families", () => {
  for (const evidence of [
    "Confirmed-order producibility:",
    "Material-clear non-material blocker check:",
    "Confirmed-order configuration completeness:",
    "Active-job-card exact material requirements:",
    "BOM-to-job-card explosion reconciliation:",
    "Operation/procurable-material separation:",
    "Issued-material/open-procurement control:",
    "ATP consistency control:",
    "Committed-SKU inventory transaction lineage:",
    "Procurement backward/forward lineage:",
    "Committed shortages inside lead time:",
    "Receipt-vs-job-card due-period check: NOT VERIFIED",
    "PO lifecycle control:",
    "Confirmed-order capacity:",
    "Approved-plan capacity:",
    "Planning conclusions dependent on provisional authority:",
  ]) assert.ok(completion.includes(evidence), `missing completion control evidence: ${evidence}`);
});

test("BOM equality uses released mapping IDs and exact job-card material lines", () => {
  assert.match(completion, /jsonb_array_elements_text/);
  assert.match(completion, /released_mapping_set/);
  assert.match(completion, /epr_bom_inventory_mappings/);
  assert.match(completion, /epr_production_job_card_lines/);
  assert.match(completion, /QUANTITY_MISMATCH/);
  assert.match(completion, /SKU_MISMATCH/);
  assert.match(completion, /UNIT_MISMATCH/);
  assert.match(completion, /procurement-ledger agreement is not a substitute/);
});

test("operational audit covers order, inventory, PO, supplier, capacity, routing and CTP authorities", () => {
  for (const authority of [
    "vyndi_report_order_book_sync",
    "vyndi_report_bom_compliance",
    "vyndi_report_procurement_net_requirement",
    "vyndi_report_reservation_health",
    "vyndi_inventory_balance",
    "epr_inventory_ledger",
    "vyndi_procurement_cost_authority",
    "vyndi_purchase_order_status",
    "vyndi_goods_receipts",
    "vyndi_supplier_invoices",
    "vyndi_supplier_payments",
    "vyndi_supply_planning_parameters",
    "vyndi_supplier_lane_revisions",
    "vyndi_routing_revisions",
    "vyndi_capacity_standards",
    "vyndi_ibpe_runs",
  ]) assert.match(audit, new RegExp(authority));

  for (const conclusion of [
    "Sales-order/job-card revision control:",
    "Inventory reservation health:",
    "ATP non-negativity control:",
    "Inventory arithmetic reconciliation:",
    "Draft-PO price-authority control:",
    "PO duplicate/excess coverage control:",
    "Active-procurement supplier approval control:",
    "Supplier/IBPE lead-time authority:",
    "Procurement price-authority usage:",
    "Received-PO GRN/inventory-receipt evidence:",
    "Work-centre overload reconciliation:",
    "Manufacturing-routing coverage:",
    "Capacity-standard authority:",
    "Firm capable-to-promise (CTP): NOT YET ELIGIBLE",
    "Capacity-expansion test:",
  ]) assert.ok(audit.includes(conclusion), `missing exact audit conclusion: ${conclusion}`);
});

test("firm CTP answer is authority gated rather than inferred from zero capacity shortfall", () => {
  assert.match(audit, /Firm capable-to-promise \(CTP\): NOT YET ELIGIBLE/);
  assert.match(audit, /capacity standards/);
  assert.match(audit, /approved persisted routing/);
  assert.match(audit, /approved persisted supplier-lane/);
  assert.match(audit, /must not state a firm customer promise date/);
});
