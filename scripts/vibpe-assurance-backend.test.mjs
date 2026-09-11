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

// G6 — initial coverage plus one self-contained forward reconciliation.
const g6Initial = readFileSync(new URL("../migrations/0054_vibpe_authority_coverage.sql", import.meta.url), "utf8");
const g6 = readFileSync(new URL("../migrations/0055_vibpe_g6_reconciliation.sql", import.meta.url), "utf8");

test("G6 covers canonical Product, Engineering, Quality, People & Office, Dispatch, Finance and Governance authorities", () => {
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
    "people_office_cost_item",
    "people_office_asset",
    "supplier_invoice",
    "supplier_payment",
    "ibpe_run",
    "ibpe_report_snapshot",
    "ibpe_management_action",
    "ibpe_decision",
    "ibpe_business_update_proposal",
    "vibpe_assurance_snapshot",
  ]) assert.match(g6, new RegExp(`'${entity}'`));

  assert.match(g6, /G04-ENG-RELEASE/);
  assert.match(g6, /G08-AP-MATCH/);
  assert.match(g6, /G11-PEOPLE-OFFICE/);
  assert.match(g6, /where gate_id='G10-QUALITY'/);
  assert.match(g6, /where gate_id='G12-DISPATCH'/);
  assert.match(g6, /where gate_id='G13-FINANCE'/);
  assert.match(g6, /where gate_id='G15-AUDIT'/);
});

test("G6 extends governed workflows through Quality release, Operations Dispatch, procure-to-pay and management assurance", () => {
  assert.match(g6, /'order-to-cash',65,'quality','Quality Release'/);
  assert.match(g6, /'order-to-cash',70,'dispatch','Operations Dispatch'/);
  assert.match(g6, /'procure-to-pay',30,'supplier-invoice'/);
  assert.match(g6, /'procure-to-pay',40,'supplier-payment'/);
  assert.match(g6, /'people-office-to-finance'/);
  assert.match(g6, /'governed-management'/);
});

test("G6 separates full backend authority from unproved route binding and preserves explicit gaps", () => {
  assert.match(g6, /'table:quality-releases'[^\n]+'full'/);
  assert.match(g6, /'service:quality-authority'[^\n]+'full'/);

  for (const surface of ["route:product", "route:engineering", "route:quality", "route:people-office", "route:dispatch-visibility"]) {
    const escaped = surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(g6, new RegExp(`coverage_status='gap'[\\s\\S]+?surface_id='${escaped}'`));
  }

  for (const surface of ["route:cash", "route:payables", "route:balance-sheet", "route:risk", "route:legal"]) {
    assert.match(g6Initial, new RegExp(`'${surface}'[^\\n]+?'gap'`), `${surface} must be explicitly represented as a gap`);
    assert.match(g6, new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${surface} must survive reconciliation`);
  }
});

test("G6 deterministic exception checks cover the newly canonical authority graph", () => {
  for (const type of [
    "confirmed_order_unknown_product_variant",
    "approved_product_missing_released_engineering",
    "quality_release_without_passing_final_inspection",
    "completed_job_card_missing_quality_release",
    "people_office_approval_attribution_missing",
    "dispatch_missing_job_card_lineage",
    "dispatch_exceeds_quality_release",
    "supplier_payment_without_approved_invoice",
    "ibpe_decision_attribution_missing",
    "assurance_surface_gap",
  ]) assert.match(g6, new RegExp(type));
});

test("G6 reconciliation removes semantic aliases and standardises Dispatch ownership", () => {
  assert.match(g6, /delete from vyndi_vibpe_entity_registry where entity_type='people_office_cost'/);
  assert.match(g6, /delete from vyndi_vibpe_gate_registry where gate_id in \('G04-PRODUCT-MASTER','G08-PEOPLE-OFFICE'\)/);
  assert.match(g6, /set domain='operations'/);
  assert.match(g6, /drop view if exists vyndi_vibpe_all_exceptions/);
});

test("G6 standardises live reads and snapshots on the unified assurance exception stream", () => {
  assert.match(g6, /create or replace view vyndi_vibpe_assurance_exceptions_all/);
  assert.match(g6, /from vyndi_vibpe_assurance_exceptions_all/);
  assert.match(g6, /'exceptionView','vyndi_vibpe_assurance_exceptions_all'/);
  assert.match(g6, /view:vibpe-assurance-exceptions-all/);
  assert.match(service, /from vyndi_vibpe_assurance_exceptions_all/);
  assert.doesNotMatch(service, /from vyndi_vibpe_all_exceptions/);
});

test("G6 remains backend-only and does not cross the protected R3 UI boundary", () => {
  for (const sql of [g6Initial, g6]) {
    assert.doesNotMatch(sql, /createFileRoute|command-shell-v2|WORKFLOW_STAGES|workspaceForRoute/);
  }
});
