import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../migrations/0056_vibpe_ui_assurance.sql", import.meta.url), "utf8");
const workflowExpansion = readFileSync(new URL("../migrations/0073_vibpe_governed_workflow_ui_assurance.sql", import.meta.url), "utf8");
const remediation = readFileSync(new URL("../migrations/0057_vibpe_assurance_remediation.sql", import.meta.url), "utf8");
const shortageTrigger = readFileSync(new URL("../migrations/0058_vibpe_shortage_response_trigger.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/lib/vibpe-ui-assurance.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/routes/api/vibpe/ui-assurance.ts", import.meta.url), "utf8");
const runner = readFileSync(new URL("./vibpe-ui-assurance-runner.mjs", import.meta.url), "utf8");
const observer = readFileSync(new URL("../src/components/vibpe-runtime-observer.tsx", import.meta.url), "utf8");
const commandRoute = readFileSync(new URL("../src/routes/command/route.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/routes/command/ibpe-operating-workspace_.assurance.tsx", import.meta.url), "utf8");
const outputs = readFileSync(new URL("../src/routes/command/ibpe-operating-workspace_.outputs.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../src/lib/operating-workflow.ts", import.meta.url), "utf8");
const financeAuthority = readFileSync(new URL("../src/lib/finance-governance-authority.ts", import.meta.url), "utf8");
const route = (name) => readFileSync(new URL(`../src/routes/command/${name}.tsx`, import.meta.url), "utf8");

test("UI assurance has a declarative registry, observations, explicit unobserved state and unified exception projection", () => {
  assert.match(migration, /vyndi_vibpe_ui_capability_registry/);
  assert.match(migration, /vyndi_vibpe_ui_observations/);
  assert.match(migration, /vyndi_vibpe_ui_assurance_exceptions/);
  assert.match(migration, /vyndi_vibpe_ui_coverage_summary/);
  assert.match(migration, /ui_capability_unobserved/);
  assert.match(migration, /vyndi_vibpe_assurance_exceptions_all/);
  assert.match(migration, /UI-AUTH-SESSION/);
  assert.match(migration, /UI-ACTION-LIFECYCLE/);
  assert.match(migration, /UI-VIBPE-ASSURANCE/);
  for (const id of ["UI-VIBPE-WORKSPACE","UI-VIBPE-AUTHORITY","UI-VIBPE-OPTIMIZER","UI-VIBPE-OUTPUTS","UI-VIBPE-ASSURANCE","UI-VIBPE-RELEASE"])
    assert.ok(workflowExpansion.includes(id), `missing governed VIBPE UI capability ${id}`);
});

test("UI observation service is protected and writes only assurance evidence", () => {
  assert.match(service, /requireBusinessActor\(\s*"edit"/);
  assert.match(service, /insert into vyndi_vibpe_ui_observations/);
  assert.doesNotMatch(service, /(?:insert into|update|delete from)\s+(?:vyndi_sales_orders|epr_production_job_cards|epr_inventory_reservations|vyndi_purchase_orders|vyndi_shipments|vyndi_invoices|vyndi_collections)/i);
});

test("UI assurance API is protected and validates registered capability routes", () => {
  assert.match(api, /createFileRoute\("\/api\/vibpe\/ui-assurance"\)/);
  assert.match(api, /requireBusinessActor\("view"\)/);
  assert.match(api, /requireBusinessActor\("edit"\)/);
  assert.match(api, /unknown_capability/);
  assert.match(api, /route_mismatch/);
});

test("Cloudflare-first Playwright runner checks authority and workflow surfaces and records evidence", () => {
  assert.match(runner, /from "playwright"/);
  assert.match(runner, /cloudflare-production/);
  for (const protectedRoute of [
    "/command/sales",
    "/command/product",
    "/command/engineering",
    "/command/bom-control",
    "/command/inventory",
    "/command/procurement-planning",
    "/command/production",
    "/command/quality",
    "/command/people-office",
    "/command/operations",
    "/command/actions",
    "/command/ibpe-operating-workspace",
    "/command/ibpe-operating-workspace/authority",
    "/command/ibpe-operating-workspace/optimizer",
    "/command/ibpe-operating-workspace/outputs",
    "/command/ibpe-operating-workspace/assurance",
    "/command/ibpe-operating-workspace/release",
  ]) assert.ok(runner.includes(protectedRoute), `missing protected route check: ${protectedRoute}`);
  assert.match(runner, /\/api\/vibpe\/ui-assurance/);
  assert.match(runner, /something went wrong\|application error\|internal server error/i);
  assert.match(runner, /Start\|Complete/i);
});

test("final VIBPE Assurance page consumes canonical backend evidence and does not become a business writer", () => {
  assert.match(page, /createFileRoute\("\/command\/ibpe-operating-workspace_?\/assurance"\)/);
  assert.match(page, /getVibpeAssuranceCoverage/);
  assert.match(page, /listVibpeAssuranceExceptions/);
  assert.match(page, /getVibpeUiAssurance/);
  assert.match(page, /captureVibpeAssuranceSnapshot/);
  assert.match(page, /unproved route remains a gap/i);
  assert.match(page, /does not become a duplicate writer/i);
  assert.doesNotMatch(page, /(?:insert into|update|delete from)\s+(?:vyndi_sales_orders|epr_production_job_cards|vyndi_shipments|vyndi_invoices|vyndi_collections)/i);
});

test("VIBPE outputs consolidate governed evidence without transaction authority", () => {
  assert.match(outputs, /createFileRoute\("\/command\/ibpe-operating-workspace\/outputs"\)/);
  assert.match(outputs, /getAdvancedPlanningAuthorityReadiness/);
  assert.match(outputs, /getAdvancedOptimizerControlState/);
  assert.match(outputs, /getVibpeOptimizerReleaseClosure/);
  assert.match(outputs, /listVibpeAssuranceExceptions/);
  assert.match(outputs, /Machine-readable evidence summary/);
  assert.match(outputs, /No transaction authority is created here/);
  assert.doesNotMatch(outputs, /(?:insert into|update|delete from)\s+(?:vyndi_sales_orders|epr_production_job_cards|epr_inventory_reservations|vyndi_purchase_orders|vyndi_shipments|vyndi_invoices|vyndi_collections)/i);
});

test("Command navigation exposes the complete sequential VIBPE workflow without changing workspace ownership", () => {
  for (const routePath of [
    "/command/ibpe-operating-workspace",
    "/command/ibpe-operating-workspace/authority",
    "/command/ibpe-operating-workspace/optimizer",
    "/command/ibpe-operating-workspace/outputs",
    "/command/ibpe-operating-workspace/assurance",
    "/command/ibpe-operating-workspace/release",
  ]) assert.ok(workflow.includes(routePath), `missing VIBPE navigation route ${routePath}`);
  for (const label of ["01 · Operating Workspace","02 · Planning Authority","03 · Governed Optimizer","04 · Outputs & Evidence","05 · VIBPE Assurance","06 · Release Readiness"])
    assert.ok(workflow.includes(label), `missing VIBPE navigation label ${label}`);
  assert.match(workflow, /COMMAND_CONTEXT/);
});

test("VIBPE remediation binds all ten reported gap routes to canonical authorities", () => {
  for (const id of [
    "route:product","route:engineering","route:quality","route:people-office","route:dispatch-visibility",
    "route:payables","route:cash","route:balance-sheet","route:risk","route:legal",
  ]) assert.ok(remediation.includes(`'${id}'`), `missing remediation surface ${id}`);
  assert.match(remediation, /coverage_status='full'/);
  assert.match(route("product"), /listCanonicalProductCatalog/);
  assert.doesNotMatch(route("product"), /useVeloxis|TIERS|buildModelWithInputs/);
  assert.match(route("engineering"), /listEngineeringAuthority/);
  assert.doesNotMatch(route("engineering"), /ENGINEERING_REVISIONS|useVeloxis/);
  assert.match(route("quality"), /listQualityAuthority/);
  assert.doesNotMatch(route("quality"), /quality-engine|QUALITY_CHECKS|WARRANTY_CASES/);
  assert.match(route("people-office"), /listPeopleOfficeAuthority/);
  assert.doesNotMatch(route("people-office"), /useVeloxis|buildPeopleLedger|buildOfficeLedger/);
  assert.match(route("operations"), /listDispatchRegister/);
  assert.doesNotMatch(route("operations"), /qualitySummary/);
  assert.match(route("cash"), /listCanonicalCashAuthority/);
  assert.doesNotMatch(route("cash"), /buildAccountingModel|useVeloxis/);
  assert.match(route("balance-sheet"), /listCanonicalBalanceSheetAuthority/);
  assert.doesNotMatch(route("balance-sheet"), /buildAccountingModel|useVeloxis/);
  assert.match(route("legal"), /listCanonicalLegalAuthority/);
  assert.doesNotMatch(route("legal"), /@\/lib\/data\/legal/);
  assert.match(route("risk"), /listCanonicalRiskAuthority/);
  assert.doesNotMatch(route("risk"), /const RISKS|@\/lib\/data\/legal|SCENARIOS/);
  assert.match(route("payables"), /@\/lib\/procure-to-pay-authority/);
});

test("critical shortage receives an automatic governed draft procurement response", () => {
  assert.match(remediation, /ensure_vyndi_shortage_procurement_response/);
  assert.match(remediation, /insert into epr_procurement_sku_actions/);
  assert.match(remediation, /insert into vyndi_purchase_orders/);
  assert.match(remediation, /'draft','VIBPE-SHORTAGE:/);
  assert.match(remediation, /supplierCommitment',false/);
  assert.match(remediation, /system:vibpe-remediation/);
  assert.match(shortageTrigger, /after update of shortage_quantity/);
  assert.match(shortageTrigger, /ensure_vyndi_shortage_procurement_response/);
});

test("finance, legal and risk have persisted canonical source authority", () => {
  assert.match(remediation, /vyndi_cash_authority/);
  assert.match(remediation, /vyndi_financial_statement_snapshots/);
  assert.match(remediation, /vyndi_balance_sheet_authority/);
  assert.match(remediation, /vyndi_risk_register/);
  assert.match(remediation, /vyndi_legal_register/);
  assert.match(financeAuthority, /listCanonicalCashAuthority/);
  assert.match(financeAuthority, /listCanonicalBalanceSheetAuthority/);
  assert.match(financeAuthority, /postFinancialStatementSnapshot/);
  assert.match(financeAuthority, /Math\.abs\(balanceError\) > 0\.01/);
});

test("authenticated runtime observer can evidence every registered UI capability", () => {
  for (const id of [
    "UI-AUTH-SESSION","UI-SALES-LOAD","UI-SALES-CONFIRM","UI-PRODUCT-LOAD","UI-ENGINEERING-LOAD","UI-BOM-LOAD",
    "UI-INVENTORY-LOAD","UI-PROCUREMENT-LOAD","UI-PRODUCTION-LOAD","UI-QUALITY-LOAD","UI-PEOPLE-OFFICE-LOAD",
    "UI-DISPATCH-VISIBILITY","UI-ACTION-INBOX","UI-ACTION-LIFECYCLE","UI-CONTROL-TOWER",
    "UI-VIBPE-WORKSPACE","UI-VIBPE-AUTHORITY","UI-VIBPE-OPTIMIZER","UI-VIBPE-OUTPUTS","UI-VIBPE-ASSURANCE","UI-VIBPE-RELEASE",
  ]) assert.ok(observer.includes(id), `missing runtime observer capability ${id}`);
  assert.match(observer, /credentials: "include"/);
  assert.match(observer, /authenticated-route-sweep/);
  assert.match(observer, /DOMParser/);
  assert.match(observer, /\/api\/vibpe\/ui-assurance/);
  assert.match(observer, /probeAuthenticatedSession/);
  assert.match(observer, /payload\?\.ok === true/);
  assert.match(observer, /actorPresent/);
  assert.match(observer, /passedCount === capabilities\.length/);
  assert.match(observer, /sessionStorage\.removeItem/);
  assert.match(observer, /cloudflare-production/);
  assert.match(observer, /vercel-production/);
  assert.match(commandRoute, /VibpeRuntimeObserver/);
});
