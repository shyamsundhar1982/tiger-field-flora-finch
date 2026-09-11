import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../migrations/0047_vibpe_assurance_backend.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/lib/vibpe-assurance.ts", import.meta.url), "utf8");

test("VIBPE assurance backend extends the canonical audit model without replacing it", () => {
  assert.match(migration, /alter table vyndi_audit_events/);
  assert.match(migration, /correlation_id text/);
  assert.match(migration, /gate_id text/);
  assert.match(migration, /gate_result text/);
  assert.match(migration, /create table if not exists vyndi_vibpe_assurance_evidence/);
  assert.doesNotMatch(migration, /drop table\s+vyndi_audit_events/i);
});

test("VIBPE has explicit entity, gate and order-to-cash workflow registries", () => {
  assert.match(migration, /vyndi_vibpe_entity_registry/);
  assert.match(migration, /vyndi_vibpe_gate_registry/);
  assert.match(migration, /vyndi_vibpe_workflow_registry/);
  assert.match(migration, /G07-PROD-RELEASE/);
  assert.match(migration, /G15-AUDIT/);
  assert.match(migration, /'order-to-cash',90,'collection'/);
});

test("critical confirmed-demand to missing-job-card failure is detected", () => {
  assert.match(migration, /confirmed_order_missing_job_card/);
  assert.match(migration, /o\.status='confirmed'/);
  assert.match(migration, /c\.sales_order_revision=o\.revision/);
  assert.match(migration, /where c\.id is null/);
});

test("assurance exception engine covers required cross-domain integrity failures", () => {
  for (const type of [
    "orphan_job_card",
    "stale_job_card_revision",
    "duplicate_job_card_for_revision",
    "shortage_without_procurement_action",
    "approved_build_missing_traveller",
    "shipment_without_approved_build",
    "invoice_without_posted_shipment",
    "missing_audit_event",
    "audit_actor_attribution_missing",
  ]) {
    assert.match(migration, new RegExp(type));
  }
});

test("snapshot evidence is immutable-by-capture and audited with gate result", () => {
  assert.match(migration, /capture_vibpe_assurance_snapshot/);
  assert.match(migration, /insert into vyndi_vibpe_assurance_snapshots/);
  assert.match(migration, /insert into vyndi_vibpe_assurance_evidence/);
  assert.match(migration, /'G15-AUDIT'/);
  assert.match(migration, /case when v_critical=0 then 'PASS' else 'FAIL' end/);
});

test("backend service exposes read coverage, live exceptions, and controlled snapshot capture only", () => {
  assert.match(service, /getVibpeAssuranceCoverage/);
  assert.match(service, /listVibpeAssuranceExceptions/);
  assert.match(service, /captureVibpeAssuranceSnapshot/);
  assert.match(service, /requireBusinessActor\(\s*"view"/);
  assert.match(service, /requireBusinessActor\(\s*"approve"/);
  assert.doesNotMatch(service, /createFileRoute|command-shell|navigation|workspaceForRoute/);
});

// UI-scope guard checks code constructs, not prose comments.
test("surface inventory records backend visibility without changing UI structure", () => {
  const surfaces = readFileSync(new URL("../migrations/0048_vibpe_surface_inventory.sql", import.meta.url), "utf8");
  assert.match(surfaces, /vyndi_vibpe_surface_registry/);
  assert.match(surfaces, /route:quality/);
  assert.match(surfaces, /'gap'/);
  assert.match(surfaces, /order\/job-card-linked inspection evidence is not yet persisted/i);
  assert.doesNotMatch(surfaces, /command-shell-v2|createFileRoute|WORKFLOW_STAGES|workspaceForRoute/);
});

// G6 — authority coverage extension after canonical Product/Engineering/Quality/People/Dispatch cutover.
const g6 = readFileSync(new URL("../migrations/0054_vibpe_authority_coverage.sql", import.meta.url), "utf8");

test("G6 registers every newly canonical authority domain and corrects Dispatch ownership", () => {
  for (const entity of [
    "product_family",
    "product_variant",
    "engineering_baseline",
    "engineering_change_request",
    "quality_inspection",
    "quality_ncr",
    "quality_capa",
    "quality_release",
    "people_record",
    "people_office_cost",
    "people_office_asset",
  ]) assert.match(g6, new RegExp(`'${entity}'`));
  assert.match(g6, /where entity_type='shipment'/);
  assert.match(g6, /set domain='dispatch'/);
  assert.match(g6, /G04-PRODUCT-MASTER/);
  assert.match(g6, /G08-PEOPLE-OFFICE/);
  assert.match(g6, /where gate_id='G12-DISPATCH'/);
});

test("G6 makes Quality canonical while preserving unproved Finance/Governance areas as explicit gaps", () => {
  assert.match(g6, /'route:quality'.+'full'/s);
  for (const surface of ["route:cash", "route:payables", "route:balance-sheet", "route:risk", "route:legal"]) {
    assert.match(g6, new RegExp(`'${surface}'[^\\n]+?'gap'`), `${surface} must remain an explicit gap until canonical authority is proven`);
  }
  assert.match(g6, /assurance_surface_gap/);
  assert.match(g6, /where r\.coverage_status='gap'/);
});

test("G6 adds deterministic exception checks for new Product, Engineering, Quality, People & Office and Dispatch authorities", () => {
  for (const type of [
    "product_family_missing_released_engineering_baseline",
    "released_engineering_baseline_missing_approver",
    "completed_traveller_missing_quality_release",
    "quality_release_with_open_ncr",
    "approved_people_record_missing_approver",
    "approved_people_office_cost_missing_approver",
    "approved_people_office_asset_missing_approver",
    "posted_dispatch_missing_job_card",
    "dispatch_owner_mismatch",
  ]) assert.match(g6, new RegExp(type));
});

test("G6 unifies core and authority exceptions for live reads and immutable snapshots", () => {
  assert.match(g6, /create or replace view vyndi_vibpe_all_exceptions/);
  assert.match(g6, /select \* from vyndi_vibpe_assurance_exceptions/);
  assert.match(g6, /select \* from vyndi_vibpe_authority_exceptions/);
  assert.match(g6, /from vyndi_vibpe_all_exceptions/);
  assert.match(g6, /'exceptionView','vyndi_vibpe_all_exceptions'/);
  assert.match(service, /from vyndi_vibpe_all_exceptions/);
});

test("G6 remains backend-only and does not cross the protected R3 UI boundary", () => {
  assert.doesNotMatch(g6, /createFileRoute|command-shell-v2|WORKFLOW_STAGES|workspaceForRoute/);
});
