import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCommandRole } from "@/lib/command-access";
import { requireBusinessActor } from "@/lib/business-actor";
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
  reserved_quantity: number | string;
  available_to_promise: number | string;
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

const entrySchema = z.object({
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
}).superRefine((entry, context) => {
  if (entry.quantityReceived > 0 && !entry.reference) {
    context.addIssue({ code: "custom", path: ["reference"], message: "A receipt reference is required when quantity is received." });
  }
});

const issueSchema = z.object({
  itemId: z.string().min(1).max(200),
  quantity: z.number().positive().max(1_000_000_000),
  issuedOn: z.string().date(),
  reference: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000),
});

async function requireInventoryView() {
  const role = await getCommandRole();
  const page = getRouteMeta("/command/inventory");
  if (!role || !canPerform(role, "view", page)) throw new Error("Inventory view permission denied.");
}
async function requireInventoryWrite() {
  const actor = await requireBusinessActor("edit");
  const page = getRouteMeta("/command/inventory");
  if (!canPerform(actor.role, "edit", page)) throw new Error("Inventory edit permission denied.");
  return actor;
}

const globalRef = globalThis as typeof globalThis & { __masterInventorySeedPromise__?: Promise<void> };

/** Catalogue rows are master data only. Rate/MSL/category may be seeded; quantity never is. */
async function ensureComponentCatalogue(sql: Sql) {
  const seed = SEED_INVENTORY.map((item) => ({
    id: `component-${item.id}`,
    sku: item.sku.toLocaleUpperCase(),
    name: `${item.brand} · ${item.model}`,
    category: item.category,
    unit: "ea",
    minimum_stock_level: Math.max(0, item.reorderLevel),
    planned_monthly_use: 0,
  }));
  await sql.query(
    `with seed as (
       select * from json_to_recordset($1::json) as x(
         id text,sku text,name text,category text,unit text,minimum_stock_level numeric,planned_monthly_use numeric
       )
     )
     insert into master_inventory_items
       (id,ledger_id,sku,name,category,unit,minimum_stock_level,planned_monthly_use,created_by,updated_by)
     select id,'components',upper(sku),name,category,unit,minimum_stock_level,planned_monthly_use,'catalogue-seed','catalogue-seed'
       from seed
     on conflict (sku) do nothing`,
    [JSON.stringify(seed)],
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
  await requireInventoryView();
  const sql = await getSql();
  await ensureSeeds(sql);
  const [items, lots] = await Promise.all([
    sql.query<MasterInventoryItemRecord>(`
      with fifo as (
        select sku,vyndi_canonical_unit(unit) as unit,count(*)::int as lot_count,
               coalesce(sum(quantity_remaining * unit_cost_inr),0) as stock_value_inr,
               max(received_at)::date::text as last_received_on
          from epr_inventory_fifo_layers
         where quantity_remaining>0
         group by sku,vyndi_canonical_unit(unit)
      )
      select i.id,i.ledger_id,i.sku,i.name,i.category,i.unit,i.minimum_stock_level,i.planned_monthly_use,
             coalesce(atp.physical_quantity,0) as available_quantity,
             coalesce(atp.reserved_quantity,0) as reserved_quantity,
             coalesce(atp.available_to_promise,0) as available_to_promise,
             coalesce(f.stock_value_inr,0) as stock_value_inr,
             coalesce(f.lot_count,0)::int as lot_count,
             f.last_received_on,
             i.updated_at::text as updated_at
        from master_inventory_items i
        left join vyndi_inventory_available_to_promise atp on atp.sku=i.sku and atp.unit=vyndi_canonical_unit(i.unit)
        left join fifo f on f.sku=i.sku and f.unit=vyndi_canonical_unit(i.unit)
       where i.active=true
       order by i.ledger_id,i.category,i.name,i.sku
    `),
    sql.query<MasterInventoryLotRecord>(`
      select f.id,i.id as item_id,i.ledger_id,i.sku,i.name,i.category,i.unit,
             i.minimum_stock_level,i.planned_monthly_use,
             f.quantity_received,f.quantity_remaining,
             (f.quantity_received-f.quantity_remaining) as allocated_quantity,
             f.unit_cost_inr,f.received_at::date::text as received_on,
             meta.expiry_on::text as expiry_on,meta.next_inspection_on::text as next_inspection_on,
             m.reference,m.notes,
             max(issue.created_at)::date::text as last_issue_on,
             f.created_at::text as created_at
        from epr_inventory_fifo_layers f
        join epr_inventory_ledger receipt_ledger on receipt_ledger.id=f.source_ledger_id
        join epr_inventory_movements m on m.id=receipt_ledger.movement_id
        join master_inventory_items i on i.sku=f.sku and vyndi_canonical_unit(i.unit)=vyndi_canonical_unit(f.unit) and i.active=true
        left join vyndi_inventory_receipt_metadata meta on meta.movement_id=m.id
        left join epr_inventory_fifo_allocations a on a.layer_id=f.id
        left join epr_inventory_ledger issue_ledger on issue_ledger.id=a.issue_ledger_id
        left join epr_inventory_movements issue on issue.id=issue_ledger.movement_id
       group by f.id,i.id,m.id,meta.movement_id
       order by i.ledger_id,i.sku,f.received_at asc,f.id asc
    `),
  ]);
  return { items, lots };
});

export const saveMasterInventoryEntry = createServerFn({ method: "POST" })
  .validator(entrySchema)
  .handler(async ({ data }) => {
    const actor = await requireInventoryWrite();
    const sql = await getSql();
    const itemId = `inventory-${crypto.randomUUID()}`;
    const movementId = `REC-${crypto.randomUUID()}`;
    const ledgerEntryId = `LED-${crypto.randomUUID()}`;
    const rows = await sql.query<{ item_id: string; lot_id: string | null }>(
      `select * from save_vyndi_master_inventory_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::date,$14::date,$15::date,$16,$17,$18,$19)`,
      [itemId,movementId,ledgerEntryId,data.ledgerId,data.sku,data.name,data.category,data.unit,
       data.minimumStockLevel,data.plannedMonthlyUse,data.quantityReceived,data.unitCostInr,data.receivedOn,
       data.expiryOn || null,data.nextInspectionOn || null,data.reference,data.notes,actor.userId,actor.role],
    );
    return rows[0];
  });

export const issueMasterInventoryFifo = createServerFn({ method: "POST" })
  .validator(issueSchema)
  .handler(async ({ data }) => {
    const actor = await requireInventoryWrite();
    const sql = await getSql();
    const movementId = `ISS-${crypto.randomUUID()}`;
    const ledgerEntryId = `LED-${crypto.randomUUID()}`;
    const rows = await sql.query<{ issue_id: string; quantity_issued: number | string; issue_value_inr: number | string }>(
      `select * from issue_vyndi_master_inventory_fifo($1,$2,$3,$4,$5::date,$6,$7,$8,$9)`,
      [movementId,ledgerEntryId,data.itemId,data.quantity,data.issuedOn,data.reference,data.notes,actor.userId,actor.role],
    );
    return rows[0];
  });

export const getMasterInventoryCutoverReport = createServerFn({ method: "GET" }).handler(async () => {
  await requireInventoryView();
  const sql = await getSql();
  return sql`
    select * from vyndi_master_inventory_cutover_report
    order by reconciliation_class,ledger_id,sku,received_on,legacy_lot_id
  `;
});
