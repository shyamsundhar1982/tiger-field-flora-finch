import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function text(path) { return readFile(new URL(`../${path}`, import.meta.url), "utf8"); }

test("one bike / batch approval owns dependent production record creation", async () => {
  const migration = await text("migrations/0037_production_batch_auto_procurement.sql");
  assert.match(migration, /approve_vyndi_production_batch/);
  assert.match(migration, /raise_epr_traveller_for_job_card/);
  assert.match(migration, /auto_released_from_batch_approval/);
  assert.match(migration, /auto_draft_created_from_job_shortage/);
  assert.match(migration, /status='draft'/);
  assert.match(migration, /supplier_id is not null/);
  assert.match(migration, /Purchase-order approval requires a different authorised user/);
});

test("PR42 production migration remains compatible with PR44 procurement authority", async () => {
  const compat = await text("migrations/0037_a_prepare_purchase_order_view_compat.sql");
  const reconcile = await text("migrations/0038_reconcile_production_procurement_authority.sql");

  assert.match(compat, /drop view if exists vyndi_open_purchase_orders/);
  assert.match(compat, /drop view if exists vyndi_purchase_order_status/);
  assert.match(reconcile, /create or replace view vyndi_open_purchase_orders/);
  assert.match(reconcile, /vyndi_procurement_cost_authority/);
  assert.match(reconcile, /governedCostInr/);
  assert.match(reconcile, /costAuthority/);
  assert.match(reconcile, /Governed procurement cost is MISSING/);
  assert.doesNotMatch(reconcile, /legacyPriceInr/);
  assert.doesNotMatch(reconcile, /planningPriceInr/);
});

test("canonical family BOM may release only an unchanged default configuration", async () => {
  const source = await text("src/lib/production-job-card.ts");
  assert.match(source, /family-standard/);
  assert.match(source, /differs from the released .* standard BOM/);
  assert.match(source, /Release an exact variant BOM before Production/);
});

test("approval-heavy operational screens do not use forced-width horizontal registers", async () => {
  const paths = [
    "src/routes/command/master-data.tsx",
    "src/routes/command/bom-inventory-mapping.tsx",
    "src/routes/command/production.tsx",
    "src/routes/command/purchase-execution.tsx",
  ];
  for (const path of paths) {
    const source = await text(path);
    assert.doesNotMatch(source, /min-w-\[(?:9|1[0-9])\d{2}px\]/, `${path} must not hide approval/action controls behind a forced-width table`);
  }
});

test("Commercial defaults components and Production exposes one batch approval", async () => {
  const sales = await text("src/routes/command/sales.tsx");
  const production = await text("src/routes/command/production.tsx");
  assert.match(sales, /defaultConfiguration\(variantId\)/);
  assert.match(sales, /Optional component customization · defaults already selected/);
  assert.match(production, /Approve bike \/ batch/);
  assert.match(production, /approveProductionBatch/);
  assert.match(production, /Draft PO is generated when this build is approved/);
});
