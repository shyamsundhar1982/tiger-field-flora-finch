import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

export const approveProductionBatch = createServerFn({ method: "POST" })
  .validator(z.object({ jobCardId: z.string().min(1).max(160) }))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = await requireBusinessActor("approve", { userId: context.userId, email: context.userEmail });
    const sql = await getSql();
    const rows = await sql.query<{
      job_card_id: string;
      batch_code: string;
      travellers_created: number | string;
      po_drafts_created: number | string;
      shortage_sku_count: number | string;
    }>(
      `select * from approve_vyndi_production_batch($1,$2,$3)`,
      [data.jobCardId, actor.userId, actor.role],
    );
    const row = rows[0];
    if (!row) throw new Error("Production batch approval did not return a controlled record.");
    return {
      jobCardId: row.job_card_id,
      batchCode: row.batch_code,
      travellersCreated: Number(row.travellers_created),
      poDraftsCreated: Number(row.po_drafts_created),
      shortageSkuCount: Number(row.shortage_sku_count),
    };
  });
