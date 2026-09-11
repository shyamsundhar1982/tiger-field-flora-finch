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


// UI-scope guard checks code constructs, not prose comments.\ntest("surface inventory records backend visibility without changing UI structure", () => {
  const surfaces = readFileSync(new URL("../migrations/0048_vibpe_surface_inventory.sql", import.meta.url), "utf8");
  assert.match(surfaces, /vyndi_vibpe_surface_registry/);
  assert.match(surfaces, /route:quality/);
  assert.match(surfaces, /'gap'/);
  assert.match(surfaces, /order\/job-card-linked inspection evidence is not yet persisted/i);
  assert.doesNotMatch(surfaces, /command-shell-v2|createFileRoute|WORKFLOW_STAGES|workspaceForRoute/);
});
