import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireBusinessActor } from "@/lib/business-actor";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";

const id = z.string().trim().min(1).max(120);
const sourceReference = z.string().trim().min(1).max(500);
const month = z.number().int().min(1).max(36);

export type DispatchRecord = {
  shipmentId: string;
  salesOrderId: string;
  salesOrderRevision: number;
  jobCardId: string | null;
  planMonth: number;
  units: number;
  status: "posted" | "reversed";
  ownerWorkspace: "operations";
  sourceReference: string;
  qualityReleaseCount: number;
  invoiceId: string | null;
  invoiceStatus: string | null;
};

async function requireView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Dispatch view permission denied.");
}

/** Canonical Operations/Fulfilment read model for shipment execution. */
export const listDispatchRegister = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(`
    select shipment_id,sales_order_id,sales_order_revision,job_card_id,plan_month,units,status,
           owner_workspace,source_reference,current_quality_release_count,invoice_id,invoice_status
    from vyndi_dispatch_register
    order by plan_month,shipment_id
  `);
  return rows.map((row) => ({
    shipmentId: String(row.shipment_id),
    salesOrderId: String(row.sales_order_id),
    salesOrderRevision: Number(row.sales_order_revision),
    jobCardId: row.job_card_id ? String(row.job_card_id) : null,
    planMonth: Number(row.plan_month),
    units: Number(row.units),
    status: row.status as DispatchRecord["status"],
    ownerWorkspace: "operations" as const,
    sourceReference: String(row.source_reference),
    qualityReleaseCount: Number(row.current_quality_release_count ?? 0),
    invoiceId: row.invoice_id ? String(row.invoice_id) : null,
    invoiceStatus: row.invoice_status ? String(row.invoice_status) : null,
  }));
});

/**
 * Canonical Dispatch writer. The database gate verifies current-order revision,
 * completed Production and serialized Quality-release capacity before posting.
 */
export const postDispatch = createServerFn({ method: "POST" })
  .validator(z.object({ id, salesOrderId: id, planMonth: month, units: z.number().positive(), sourceReference }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ post_vyndi_shipment: string }>(
      `select post_vyndi_shipment($1,$2,$3,$4,$5,$6,$7)`,
      [data.id, data.salesOrderId, data.planMonth, data.units, data.sourceReference, actor.userId, actor.role],
    );
    return { id: rows[0]?.post_vyndi_shipment ?? data.id, ownerWorkspace: "operations" as const };
  });

export const reverseDispatch = createServerFn({ method: "POST" })
  .validator(z.object({ id, reason: z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ revision: number | string }>(
      `select reverse_vyndi_shipment($1,$2,$3,$4) as revision`,
      [data.id, data.reason, actor.userId, actor.role],
    );
    return { id: data.id, revision: Number(rows[0]?.revision ?? 0), ownerWorkspace: "operations" as const };
  });
