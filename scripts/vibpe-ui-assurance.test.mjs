import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../migrations/0056_vibpe_ui_assurance.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/lib/vibpe-ui-assurance.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/routes/api/vibpe/ui-assurance.ts", import.meta.url), "utf8");
const runner = readFileSync(new URL("./vibpe-ui-assurance-runner.mjs", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/routes/command/ibpe-operating-workspace_.assurance.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../src/lib/operating-workflow.ts", import.meta.url), "utf8");

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
  for (const route of [
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
    "/command/ibpe-operating-workspace/assurance",
  ]) assert.ok(runner.includes(route), `missing protected route check: ${route}`);
  assert.match(runner, /\/api\/vibpe\/ui-assurance/);
  assert.match(runner, /something went wrong\|application error\|internal server error/i);
  assert.match(runner, /Start\|Complete/i);
});

test("final VIBPE Assurance page consumes canonical backend evidence and does not become a business writer", () => {
  assert.match(page, /createFileRoute\("\/command\/ibpe-operating-workspace\/assurance"\)/);
  assert.match(page, /getVibpeAssuranceCoverage/);
  assert.match(page, /listVibpeAssuranceExceptions/);
  assert.match(page, /getVibpeUiAssurance/);
  assert.match(page, /captureVibpeAssuranceSnapshot/);
  assert.match(page, /unproved route remains a gap/i);
  assert.match(page, /does not become a duplicate writer/i);
  assert.doesNotMatch(page, /(?:insert into|update|delete from)\s+(?:vyndi_sales_orders|epr_production_job_cards|vyndi_shipments|vyndi_invoices|vyndi_collections)/i);
});

test("Command navigation exposes VIBPE Assurance without changing workspace ownership", () => {
  assert.match(workflow, /\/command\/ibpe-operating-workspace\/assurance/);
  assert.match(workflow, /label: "VIBPE Assurance"/);
  assert.match(workflow, /COMMAND_CONTEXT/);
});
