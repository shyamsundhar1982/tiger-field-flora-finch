import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { SEED_INVENTORY } from "@/lib/data/inventory";
import { getSql, type Sql } from "@/lib/db";
import { getRouteMeta } from "@/lib/page-metadata";
import { canPerform } from "@/lib/page-access";

export type MasterInventoryItemRecord = {
  id: string;
  ledger_id: "components" | "raw-materials" | "tooling" | "quality" | "stores-tools";
  sku: string;
  name: string;
  category: string;
  unit: string;
  minimum_stock_level: number | string;
  planned_monthly_use: number | string;
  available_quantity: number | string;
  stock_value_inr: number | string;
  lot_count: number;
  last_received_on: string | null;
  updated_at: string;
};

export type MasterInventoryLotRecord = {
  id: string;
  item_id: string;
  ledger_id: MasterInventoryItemRecord["ledger_id"];
  sku: string;
  name: string;
  category: string;
  unit: string;
  minimum_stock_level: number | string;
  planned_monthly_use: number | string;
  quantity_received: number | string;
  quantity_remaining: number | string;
  allocated_quantity: number | string;
  unit_cost_inr: number | string;
  received_on: string;
  expiry_on: string | null;
  next_inspection_on: string | null;
  reference: string;
  notes: string;
  last_issue_on: string | null;
  created_at: string;
};

const entrySchema = z
  .object({
    ledgerId: z.enum(["components", "raw-materials", "tooling", "quality", "stores-tools"]),
    sku: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    unit: z.string().trim().min(1).max(30),
    minimumStockLevel: z.number().min(0).max(1_000_000_000),
    plannedMonthlyUse: z.number().min(0).max(1_000_000_000),
    quantityReceived: z.number().min(0).max(1_000_000_000),
    unitCostInr: z.number().min(0).max(1_000_000_000_000),
    receivedOn: z.string().date(),
    expiryOn: z.string().date().or(z.literal("")),
    nextInspectionOn: z.string().date().or(z.literal("")),
    reference: z.string().trim().max(200),
    notes: z.string().trim().max(1000),
  })
  .superRefine((entry, context) => {
    if (entry.quantityReceived > 0 && !entry.reference) {
      context.addIssue({
        code: "custom",
        path: ["reference"],
        message: "A receipt reference is required when quantity is received.",
      });
    }
  });

const issueSchema = z.object({
  itemId: z.string().min(1).max(200),
  quantity: z.number().positive().max(1_000_000_000),
  issuedOn: z.string().date(),
  reference: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000),
});

async function requireInventory(permission: "view" | "edit") {
  const role = await getCommandRole();
  const page = getRouteMeta("/command/inventory");
  if (!role || !canPerform(role, permission, page))
    throw new Error(`Inventory ${permission} permission denied.`);
  return role;
}

const globalRef = globalThis as typeof globalThis & {
  __masterInventorySeedPromise__?: Promise<void>;
};

async function ensureComponentCatalogue(sql: Sql) {
  const seed = SEED_INVENTORY.map((item) => ({
    id: `component-${item.id}`,
    lot_id: `component-seed-${item.id}`,
    sku: item.sku.toLocaleUpperCase(),
    name: `${item.brand} · ${item.model}`,
    category: item.category,
    unit: "ea",
    minimum_stock_level: Math.max(0, item.reorderLevel),
    planned_monthly_use: 0,
    stock_qty: Math.max(0, item.stockQty),
    unit_cost_inr: Math.max(0, item.priceInr),
    notes: item.notes,
  }));
  const payload = JSON.stringify(seed);

  await sql.query(
    `
    with seed as (
      select * from json_to_recordset($1::json) as x(
        id text, lot_id text, sku text, name text, category text, unit text,
        minimum_stock_level numeric, planned_monthly_use numeric, stock_qty numeric,
        unit_cost_inr numeric, notes text
      )
    )
    insert into master_inventory_items
      (id, ledger_id, sku, name, category, unit, minimum_stock_level, planned_monthly_use, created_by, updated_by)
    select id, 'components', upper(sku), name, category, unit, minimum_stock_level,
      planned_monthly_use, 'catalogue-seed', 'catalogue-seed'
    from seed
    on conflict (ledger_id, sku) do nothing
  `,
    [payload],
  );

  await sql.query(
    `
    with seed as (
      select * from json_to_recordset($1::json) as x(
        id text, lot_id text, sku text, name text, category text, unit text,
        minimum_stock_level numeric, planned_monthly_use numeric, stock_qty numeric,
        unit_cost_inr numeric, notes text
      )
    )
    insert into master_inventory_lots
      (id, item_id, quantity_received, quantity_remaining, unit_cost_inr, received_on, reference, notes, created_by)
    select lot_id, item.id, stock_qty, stock_qty, unit_cost_inr, current_date,
      'Initial component catalogue', seed.notes, 'catalogue-seed'
    from seed
    join master_inventory_items item on item.id = seed.id
    where stock_qty > 0
    on conflict (id) do nothing
  `,
    [payload],
  );
}

async function ensureSeeds(sql: Sql) {
  globalRef.__masterInventorySeedPromise__ ??= ensureComponentCatalogue(sql).catch((error) => {
    globalRef.__masterInventorySeedPromise__ = undefined;
    throw error;
  });
  await globalRef.__masterInventorySeedPromise__;
}

export const getMasterInventoryData = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventory("view");
  const sql = await getSql();
  await ensureSeeds(sql);
  const [items, lots] = await Promise.all([
    sql.query<MasterInventoryItemRecord>(`
      select i.id, i.ledger_id, i.sku, i.name, i.category, i.unit,
        i.minimum_stock_level, i.planned_monthly_use,
        coalesce(sum(l.quantity_remaining), 0) as available_quantity,
        coalesce(sum(l.quantity_remaining * l.unit_cost_inr), 0) as stock_value_inr,
        count(l.id)::int as lot_count,
        max(l.received_on)::text as last_received_on,
        i.updated_at::text as updated_at
      from master_inventory_items i
      left join master_inventory_lots l on l.item_id = i.id
      where i.active = true
      group by i.id
      order by i.ledger_id, i.category, i.name, i.sku
    `),
    sql.query<MasterInventoryLotRecord>(`
      select l.id, l.item_id, i.ledger_id, i.sku, i.name, i.category, i.unit,
        i.minimum_stock_level, i.planned_monthly_use,
        l.quantity_received, l.quantity_remaining,
        coalesce(sum(a.quantity), 0) as allocated_quantity,
        l.unit_cost_inr, l.received_on::text as received_on,
        l.expiry_on::text as expiry_on, l.next_inspection_on::text as next_inspection_on,
        l.reference, l.notes, max(issue.issued_on)::text as last_issue_on,
        l.created_at::text as created_at
      from master_inventory_lots l
      join master_inventory_items i on i.id = l.item_id
      left join master_inventory_fifo_allocations a on a.lot_id = l.id
      left join master_inventory_issues issue on issue.id = a.issue_id
      where i.active = true
      group by l.id, i.id
      order by i.ledger_id, i.sku, l.received_on asc, l.created_at asc, l.id asc
    `),
  ]);
  return { items, lots };
});

export const saveMasterInventoryEntry = createServerFn({ method: "POST" })
  .validator(entrySchema)
  .handler(async ({ data }) => {
    const actor = await requireInventory("edit");
    const sql = await getSql();
    const itemId = `inventory-${crypto.randomUUID()}`;
    const lotId = `lot-${crypto.randomUUID()}`;
    const rows = await sql.query<{ item_id: string; lot_id: string | null }>(
      `select * from save_master_inventory_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date,$15,$16,$17)`,
      [
        itemId,
        lotId,
        data.ledgerId,
        data.sku,
        data.name,
        data.category,
        data.unit,
        data.minimumStockLevel,
        data.plannedMonthlyUse,
        data.quantityReceived,
        data.unitCostInr,
        data.receivedOn,
        data.expiryOn || null,
        data.nextInspectionOn || null,
        data.reference,
        data.notes,
        actor,
      ],
    );
    return rows[0];
  });

export const issueMasterInventoryFifo = createServerFn({ method: "POST" })
  .validator(issueSchema)
  .handler(async ({ data }) => {
    const actor = await requireInventory("edit");
    const sql = await getSql();
    const issueId = `issue-${crypto.randomUUID()}`;
    const rows = await sql.query<{
      issue_id: string;
      quantity_issued: number | string;
      issue_value_inr: number | string;
    }>(`select * from issue_master_inventory_fifo($1,$2,$3,$4::date,$5,$6,$7)`, [
      issueId,
      data.itemId,
      data.quantity,
      data.issuedOn,
      data.reference,
      data.notes,
      actor,
    ]);
    return rows[0];
  });
