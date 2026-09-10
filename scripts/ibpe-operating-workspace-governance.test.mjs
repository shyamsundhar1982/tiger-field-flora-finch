import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("IBPE governance persistence is isolated and append-audited", () => {
  const migration = read("migrations/0044_ibpe_operating_workspace_governance.sql");
  assert.match(migration, /create table if not exists vyndi_ibpe_report_snapshots/i);
  assert.match(migration, /create table if not exists vyndi_ibpe_management_actions/i);
  assert.match(migration, /create table if not exists vyndi_ibpe_decisions/i);
  assert.match(migration, /create table if not exists vyndi_ibpe_business_update_proposals/i);
  assert.doesNotMatch(migration, /alter table vyndi_sales_orders/i);
  assert.doesNotMatch(migration, /alter table epr_inventory/i);
  assert.doesNotMatch(migration, /alter table epr_production_job_cards/i);
});

test("IBPE business update flow requires preview then approval", () => {
  const source = read("src/lib/ibpe-operating-governance.ts");
  assert.match(source, /previewIbpeBusinessUpdate/);
  assert.match(source, /confirmIbpeBusinessUpdate/);
  assert.match(source, /applyConfirmedIbpeBusinessUpdate/);
  assert.match(source, /requireBusinessActor\("edit"\)/);
  assert.match(source, /requireBusinessActor\("approve"\)/);
  assert.match(source, /status='previewed'/);
  assert.match(source, /status='confirmed'/);
  assert.match(source, /status='blocked'/);
  assert.match(source, /vyndi_audit_events/);
});

test("protected ERP domains cannot be mutated by generic IBPE update application", () => {
  const source = read("src/lib/ibpe-operating-governance.ts");
  for (const domain of ["orders", "cash", "procurement", "inventory", "production", "engineering"]) {
    assert.match(source, new RegExp(`"${domain}"`));
  }
  assert.match(source, /No registered canonical transaction adapter for this protected domain/);
  assert.match(source, /IBPE will not bypass that boundary/);
  assert.doesNotMatch(source, /update vyndi_sales_orders/i);
  assert.doesNotMatch(source, /insert into epr_inventory/i);
  assert.doesNotMatch(source, /update epr_production_job_cards/i);
});

test("IBPE report snapshots retain governed source lineage", () => {
  const source = read("src/lib/ibpe-operating-governance.ts");
  assert.match(source, /saveIbpeReportSnapshot/);
  assert.match(source, /canonical-erp-report-pack/);
  assert.match(source, /ibpe_report_snapshot/);
});


test("IBPE proposal confirmation is idempotent and race-safe", () => {
  const source = read("src/lib/ibpe-operating-governance.ts");
  assert.match(source, /if \(existing\[0\]\.status === "confirmed"\)/);
  assert.match(source, /alreadyConfirmed: true/);
  assert.match(source, /where id=\$1 and status='previewed'/);
  assert.match(source, /if \(raced\.length && raced\[0\]\.status === "confirmed"\)/);
  assert.match(source, /confirmation did not persist/);
});


test("explicit IBPE action intent outranks protected-domain subject keywords", () => {
  const source = read("src/lib/ibpe-operating-governance.ts");
  assert.match(source, /management\\s\+action/);
  assert.match(source, /if \(explicitIntent\) return explicitIntent\[0\]/);
  assert.match(source, /\["action", \/\\b\(\?:create\|add\|record\|open\|assign\|log\)/);
  assert.match(source, /\["procurement", \/supplier\|purchase order/);
});

test("explicit IBPE decision intent outranks subject keywords", () => {
  const source = read("src/lib/ibpe-operating-governance.ts");
  assert.match(source, /\["decision", \/\\b\(\?:create\|add\|record\|log\)/);
  assert.match(source, /explicit governed command intent wins over the subject matter/i);
});
