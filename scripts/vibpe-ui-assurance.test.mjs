import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../migrations/0049_vibpe_ui_assurance.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/lib/vibpe-ui-assurance.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/routes/api/vibpe/ui-assurance.ts", import.meta.url), "utf8");
const runner = readFileSync(new URL("./vibpe-ui-assurance-runner.mjs", import.meta.url), "utf8");

test("UI assurance has a declarative registry, observations and exception projection", () => {
  assert.match(migration, /vyndi_vibpe_ui_capability_registry/);
  assert.match(migration, /vyndi_vibpe_ui_observations/);
  assert.match(migration, /vyndi_vibpe_ui_assurance_exceptions/);
  assert.match(migration, /vyndi_vibpe_ui_coverage_summary/);
  assert.match(migration, /UI-AUTH-SESSION/);
  assert.match(migration, /UI-ACTION-LIFECYCLE/);
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

test("Playwright runner checks protected workflow surfaces and records evidence", () => {
  assert.match(runner, /from "playwright"/);
  for (const route of ["/command/sales", "/command/bom-control", "/command/inventory", "/command/procurement-planning", "/command/production", "/command/actions"])
    assert.ok(runner.includes(route), `missing protected route check: ${route}`);
  assert.match(runner, /\/api\/vibpe\/ui-assurance/);
  assert.match(runner, /something went wrong\|application error\|internal server error/i);
  assert.match(runner, /Start\|Complete/i);
});
