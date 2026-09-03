import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

export type InventoryItem = {
  id: string;
  category: "groupset" | "wheelset" | "tyre";
  subcategory: string;
  brand: string;
  model: string;
  detail: string;
  sku: string;
  priceInr: number;
  stockQty: number;
  reorderLevel: number;
  coreEnabled: boolean;
  proEnabled: boolean;
  apexEnabled: boolean;
  source: string;
  notes: string;
  updatedAt: string;
};

const itemInput = z.object({
  id: z.string().min(1),
  category: z.enum(["groupset", "wheelset", "tyre"]),
  subcategory: z.string().default(""),
  brand: z.string().min(1),
  model: z.string().min(1),
  detail: z.string().default(""),
  sku: z.string().min(1),
  priceInr: z.number().int().nonnegative(),
  stockQty: z.number().int().nonnegative(),
  reorderLevel: z.number().int().nonnegative(),
  coreEnabled: z.boolean(),
  proEnabled: z.boolean(),
  apexEnabled: z.boolean(),
  source: z.string().default("Internal estimate — verify with supplier"),
  notes: z.string().default(""),
});

const rowToItem = (r: Record<string, unknown>): InventoryItem => ({
  id: String(r.id), category: r.category as InventoryItem["category"], subcategory: String(r.subcategory ?? ""),
  brand: String(r.brand), model: String(r.model), detail: String(r.detail ?? ""), sku: String(r.sku),
  priceInr: Number(r.price_inr), stockQty: Number(r.stock_qty), reorderLevel: Number(r.reorder_level),
  coreEnabled: Boolean(r.core_enabled), proEnabled: Boolean(r.pro_enabled), apexEnabled: Boolean(r.apex_enabled),
  source: String(r.source ?? ""), notes: String(r.notes ?? ""), updatedAt: String(r.updated_at),
});

export const listInventory = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select id, category, subcategory, brand, model, detail, sku, price_inr, stock_qty, reorder_level,
            core_enabled, pro_enabled, apex_enabled, source, notes, updated_at
       from component_inventory order by category, brand, model`,
  );
  return rows.map(rowToItem);
});

export const upsertInventory = createServerFn({ method: "POST" })
  .validator(itemInput)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `insert into component_inventory
        (id, category, subcategory, brand, model, detail, sku, price_inr, stock_qty, reorder_level,
         core_enabled, pro_enabled, apex_enabled, source, notes, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
       on conflict (id) do update set category=excluded.category, subcategory=excluded.subcategory,
         brand=excluded.brand, model=excluded.model, detail=excluded.detail, sku=excluded.sku,
         price_inr=excluded.price_inr, stock_qty=excluded.stock_qty, reorder_level=excluded.reorder_level,
         core_enabled=excluded.core_enabled, pro_enabled=excluded.pro_enabled, apex_enabled=excluded.apex_enabled,
         source=excluded.source, notes=excluded.notes, updated_at=now()
       returning id, category, subcategory, brand, model, detail, sku, price_inr, stock_qty, reorder_level,
                 core_enabled, pro_enabled, apex_enabled, source, notes, updated_at`,
      [data.id, data.category, data.subcategory, data.brand, data.model, data.detail, data.sku, data.priceInr,
       data.stockQty, data.reorderLevel, data.coreEnabled, data.proEnabled, data.apexEnabled, data.source, data.notes],
    );
    return rowToItem(rows[0]!);
  });

export const deleteInventory = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query("delete from component_inventory where id = $1", [data.id]);
    return { ok: true };
  });
