import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";

export const submitDraftPurchaseOrder = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().trim().min(1).max(120),
    supplierId: z.string().trim().min(1).max(120),
    unitPriceInr: z.number().positive().max(1_000_000_000_000),
    expectedReceiptOn: z.string().date(),
    paymentTermsDays: z.number().int().min(0).max(365),
    sourceReference: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(1000).optional(),
  }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    if (!canPerform(actor.role, "edit", getRouteMeta("/command/purchase-execution"))) {
      throw new Error("Purchase-order edit permission denied.");
    }
    const sql = await getSql();
    const rows = await sql.query<{ submit_vyndi_draft_purchase_order: string }>(
      `select submit_vyndi_draft_purchase_order($1,$2,$3,$4::date,$5,$6,$7,$8,$9)`,
      [data.id, data.supplierId.toUpperCase(), data.unitPriceInr, data.expectedReceiptOn, data.paymentTermsDays, data.sourceReference, data.notes ?? "", actor.userId, actor.role],
    );
    return { ok:true, id:rows[0]?.submit_vyndi_draft_purchase_order ?? data.id };
  });
