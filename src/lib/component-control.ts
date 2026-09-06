import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getAuthoritativeInventory } from "@/lib/inventory-authority";

const ventureSchema = z.enum(["carbon", "aluminium"]);

export type ComponentControlRow = {
  modelId: string;
  bomRevision: string;
  componentKey: string;
  sku: string;
  unit: string;
  requiredQty: number;
  balance: number;
  msl: number | null;
  status: "NO_STOCK" | "SHORT" | "AVAILABLE";
  belowMsl: boolean;
};

/** Operational component-control read model. It never reads legacy stock, seed inventory, or localStorage. */
export const getComponentControl = createServerFn({ method: "GET" })
  .validator(z.object({ venture: ventureSchema, modelId: z.string().optional() }))
  .handler(async ({ data }): Promise<ComponentControlRow[]> => {
    const sql = await getSql();
    const [mappings, balances, mslControls] = await Promise.all([
      sql.query<{
        model_id: string;
        bom_revision: string;
        bom_line_key: string;
        sku: string;
        quantity: number | string;
        unit: string;
      }>(
        `select model_id,bom_revision,bom_line_key,sku,quantity,unit
         from epr_bom_inventory_mappings
         where venture=$1
           and status='active'
           and effective_from<=now()
           and (effective_to is null or effective_to>now())
           and ($2::text is null or model_id=$2)
         order by model_id,bom_revision,bom_line_key,sku,unit`,
        [data.venture, data.modelId ?? null],
      ),
      getAuthoritativeInventory(),
      sql.query<{
        sku: string;
        unit: string;
        minimum_stock_level: number | string;
      }>(
        `select sku,unit,minimum_stock_level
         from epr_inventory_controls
         where venture=$1 and active=true`,
        [data.venture],
      ),
    ]);

    const balanceRows = Array.isArray(balances) ? balances.filter((row): row is Record<string, unknown> => row != null) : [];
    const balanceByKey = new Map(
      balanceRows.map((row) => [
        `${row.venture ?? data.venture}|${row.sku ?? ""}|${row.unit ?? ""}`,
        Number(row.quantity_balance ?? 0),
      ]),
    );
    const mslRows = Array.isArray(mslControls) ? mslControls.filter((row) => row != null) : [];
    const mslByKey = new Map(
      mslRows.map((row) => [
        `${data.venture}|${row.sku}|${row.unit}`,
        Number(row.minimum_stock_level),
      ]),
    );

    return (Array.isArray(mappings) ? mappings : []).filter((mapping) => mapping != null).map((mapping) => {
      const key = `${data.venture}|${mapping.sku}|${mapping.unit}`;
      const balance = balanceByKey.get(key) ?? 0;
      const requiredQty = Number(mapping.quantity);
      const msl = mslByKey.get(key) ?? null;
      const status = balance <= 0 ? "NO_STOCK" : balance < requiredQty ? "SHORT" : "AVAILABLE";
      return {
        modelId: mapping.model_id,
        bomRevision: mapping.bom_revision,
        componentKey: mapping.bom_line_key,
        sku: mapping.sku,
        unit: mapping.unit,
        requiredQty,
        balance,
        msl,
        status,
        belowMsl: msl !== null && balance < msl,
      };
    });
  });
