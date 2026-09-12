import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const intent = await readFile(new URL("../src/lib/vibpe-intent.ts", import.meta.url), "utf8");
const doctrine = await readFile(new URL("../src/lib/vibpe-business-operator.ts", import.meta.url), "utf8");
const architecture = await readFile(new URL("../docs/VIBPE-COPILOT-2-ARCHITECTURE.md", import.meta.url), "utf8");
const productionCopilot = await readFile(new URL("../src/lib/ibpe-copilot.ts", import.meta.url), "utf8");
const copilot2 = await readFile(new URL("../src/lib/vibpe-copilot-2.ts", import.meta.url), "utf8");
const operational = await readFile(new URL("../src/lib/vibpe-operational-queries.ts", import.meta.url), "utf8");
const governance = await readFile(new URL("../src/lib/vibpe-governance-queries.ts", import.meta.url), "utf8");
const governanceServer = await readFile(new URL("../src/lib/vibpe-governance-server.ts", import.meta.url), "utf8");
const copilotUi = await readFile(new URL("../src/components/ibpe-copilot.tsx", import.meta.url), "utf8");

test("VIBPE recognizes conversational closing instead of returning baseline assessment", () => {
  assert.match(intent, /bye\|goodbye\|see you\|thanks\|thank you/);
  assert.match(intent, /intent: "conversation"/);
});

test("VIBPE parses free-form lakh funding scenarios", () => {
  assert.match(intent, /cashInjectionFromQuestion/);
  assert.match(intent, /cashInjectionLakh/);
  assert.match(intent, /fund\|funding\|finance\|capital\|cash/);
});

test("VIBPE supports explicit planning horizons", () => {
  assert.match(intent, /horizonFromQuestion/);
  assert.match(intent, /"planning-horizon"/);
  assert.match(intent, /next\|coming/);
});

test("VIBPE supports product-family scenario overrides", () => {
  assert.match(intent, /longitude/i);
  assert.match(intent, /latitude/i);
  assert.match(intent, /altitude/i);
  assert.match(intent, /demandMultiplierByProduct/);
});

test("VIBPE preserves follow-up scenario context", () => {
  assert.match(intent, /next what\|then what\|what next/);
  assert.match(intent, /preservePriorScenario/);
});

test("Business Operator doctrine protects transaction boundaries", () => {
  assert.match(doctrine, /Recommendation is not a purchase order/);
  assert.match(doctrine, /Scenario is not an approved plan/);
  assert.match(doctrine, /External reference is not governed internal truth/);
});

test("architecture separates deterministic truth from advisory reasoning", () => {
  assert.match(architecture, /IBPE engine.*deterministic business truth/i);
  assert.match(architecture, /External knowledge.*reference context only/i);
});

test("VIBPE 2.0 is active ahead of the legacy production fallback", () => {
  assert.match(productionCopilot, /import \{ runVibpeCopilot2 \}/);
  assert.match(productionCopilot, /await runVibpeCopilot2\(/);
  assert.match(productionCopilot, /if \(handledByVibpe2 && vibpe2\?\.answer\)/);
  assert.match(productionCopilot, /copilotVersion: handledByVibpe2 \? "2\.0" : "legacy-fallback"/);
});

test("VIBPE 2.0 runtime errors fail safely to the governed production fallback", () => {
  assert.match(productionCopilot, /try \{[\s\S]*await runVibpeCopilot2\(/);
  assert.match(productionCopilot, /catch \{[\s\S]*vibpe2FallbackReason = "runtime-error"/);
  assert.match(productionCopilot, /vibpe2FallbackReason: vibpe2FallbackReason \?\? null/);
});

test("engineering knowledge questions route before IBPE metric fallback", () => {
  assert.match(copilot2, /function isKnowledgeQuestion/);
  assert.match(copilot2, /fork\|axle/);
  assert.match(copilot2, /retrieveVibpeKnowledgeEvidence\(sql, question, 8\)/);
  assert.match(copilot2, /Authority: No\. This evidence is unresolved\/non-governing/);
});

test("production authority wording is not treated as production capacity by the knowledge router", () => {
  assert.match(copilot2, /production authority/);
  assert.match(copilot2, /production capacity/);
  assert.match(copilot2, /return !explicitIbpeMetric/);
});

test("knowledge answers keep supporting evidence topically selective", () => {
  assert.match(copilot2, /function selectKnowledgeAnswerEvidence/);
  assert.match(copilot2, /KNOWLEDGE_EVIDENCE_STOP_WORDS/);
  assert.match(copilot2, /directMatches > 0/);
  assert.match(copilot2, /slice\(0, 2\)/);
  assert.match(copilot2, /const selected = selectKnowledgeAnswerEvidence\(question, evidence\)/);
});

test("operational reconciliation routes before generic IBPE assessment", () => {
  assert.match(copilot2, /tryOperationalDataAnswer/);
  assert.match(operational, /isOperationalReconciliationQuestion/);
  assert.match(operational, /vyndi_live_job_card_requirements/);
  assert.match(operational, /vyndi_committed_procurement_requirements/);
  assert.match(operational, /Operational reconciliation: PASS/);
  assert.match(operational, /sku is not null/);
  assert.match(operational, /issue_status = 'issued'/);
});

test("committed-demand feasibility uses exact live commitments, not reconciled planning shortage", () => {
  assert.match(operational, /isCommittedDemandFeasibilityQuestion/);
  assert.match(operational, /committedDemandFeasibilityAnswer/);
  assert.match(operational, /where status='confirmed'/);
  assert.match(operational, /o\.revision=jc\.sales_order_revision/);
  assert.match(operational, /sum\(committed_requirement\)/);
  assert.match(operational, /sum\(net_committed_shortage\)/);
  assert.match(operational, /open_po_qty/);
  assert.match(operational, /component units/);
  assert.match(operational, /broader reconciled planning shortage is intentionally not presented as committed-demand shortage/);
});

test("supplier lookup resolves governed supplier, PO and price records", () => {
  assert.match(operational, /vyndi_suppliers/);
  assert.match(operational, /vyndi_purchase_orders/);
  assert.match(operational, /vyndi_procurement_prices/);
  assert.match(operational, /oda\\b/);
  assert.match(operational, /Supplier price authority rows/);
});

test("traceability exception questions inspect missing job-card origin links instead of literal search", () => {
  assert.match(governance, /function isTraceabilityExceptionQuestion/);
  assert.match(governance, /epr_production_job_cards/);
  assert.match(governance, /left join vyndi_sales_orders/);
  assert.match(governance, /Traceability exception check: PASS/);
  assert.match(governance, /sales-order ID and sales-order revision/);
});

test("governance status questions use live actions assurance gates and workflow ledgers", () => {
  assert.match(governance, /function isGovernanceOperatingStatusQuestion/);
  assert.match(governance, /vyndi_operating_actions/);
  assert.match(governance, /vyndi_vibpe_assurance_exceptions_all/);
  assert.match(governance, /vyndi_vibpe_gate_registry/);
  assert.match(governance, /Incomplete workflow — order-to-cash/);
  assert.match(governance, /Incomplete workflow — procure-to-pay/);
  assert.match(governance, /People & Office → Finance/);
});

test("overall VYNDI RAG health synthesizes governed IBPE and live control state", () => {
  assert.match(governance, /function isOverallRagHealthQuestion/);
  assert.match(governance, /Current overall VYNDI health/);
  assert.match(governance, /GREEN — verified controls/);
  assert.match(governance, /AMBER — execution\/governance hygiene/);
  assert.match(governance, /RED — current blockers/);
  assert.match(governance, /reconciliation_mismatch_skus/);
  assert.match(governance, /vyndi_ibpe_runs/);
});

test("governance server is RBAC-protected and returns only handled governed questions", () => {
  assert.match(governanceServer, /requireBusinessActor/);
  assert.match(governanceServer, /tryGovernanceDataAnswer/);
  assert.match(governanceServer, /handled: true as const/);
});

test("Co-Pilot UI routes governance and aggregate exception questions before traceability search", () => {
  const governanceCall = copilotUi.indexOf("const governance = await askVibpeGovernanceCopilot");
  const traceabilityCall = copilotUi.indexOf("const traceability = await askTraceabilityCopilot");
  const ibpeCall = copilotUi.indexOf("const response = await askIbpeCopilot");
  assert.ok(governanceCall >= 0);
  assert.ok(traceabilityCall > governanceCall);
  assert.ok(ibpeCall > traceabilityCall);
  assert.match(copilotUi, /Governed VIBPE control state · live read-only sources/);
});
