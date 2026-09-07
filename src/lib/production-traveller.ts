import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

const raiseTravellerSchema = z.object({
  jobCardId: z.string().min(1).max(160),
  serialNumber: z.string().trim().min(3).max(120),
  engineeringRevision: z.string().trim().min(1).max(120),
  supplier: z.string().trim().max(200).default(""),
});

/**
 * Raise a serial-controlled Production traveller from an existing released job card.
 * The client supplies only the job card and serial-specific fields. Model, family,
 * variant, BOM and Commercial-order provenance are derived and validated in SQL.
 */
export const createProductionTraveller = createServerFn({ method: "POST" })
  .validator(raiseTravellerSchema)
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const travellerId = `TRV-${crypto.randomUUID()}`;
    const rows = await sql.query<{
      traveller_id: string;
      traveller_status: string;
      model_name: string;
      bom_revision: string;
      sales_order_id: string;
      job_card_id: string;
    }>(
      `select * from raise_epr_traveller_for_job_card($1,$2,$3,$4,$5,$6,$7)`,
      [
        travellerId,
        data.jobCardId,
        data.serialNumber.trim(),
        data.engineeringRevision.trim(),
        data.supplier.trim(),
        actor.userId,
        actor.role,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("Production traveller was not created.");
    return {
      travellerId: row.traveller_id,
      status: row.traveller_status,
      modelName: row.model_name,
      bomRevision: row.bom_revision,
      salesOrderId: row.sales_order_id,
      jobCardId: row.job_card_id,
    };
  });
