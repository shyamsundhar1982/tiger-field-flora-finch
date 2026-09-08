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
