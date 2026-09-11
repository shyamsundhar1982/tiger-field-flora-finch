import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { requireBusinessActor } from "@/lib/business-actor";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { postDispatch, reverseDispatch } from "@/lib/dispatch-authority";

const id = z.string().trim().min(1).max(120);
const sourceReference = z.string().trim().min(1).max(500);
const month = z.number().int().min(1).max(36);

export type ShipmentRecord = {
  id: string;
  salesOrderId: string;
  planMonth: number;
  units: number;
  status: "posted" | "reversed";
  sourceReference: string;
};
export type InvoiceRecord = {
  id: string;
  shipmentId: string;
  salesOrderId: string;
  planMonth: number;
  units: number;
  aspLakh: number;
  amountLakh: number;
  status: "issued" | "void";
  sourceReference: string;
};
export type CollectionRecord = {
  id: string;
  invoiceId: string;
  planMonth: number;
  amountLakh: number;
  status: "posted" | "reversed";
  sourceReference: string;
};

async function requireView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Shipment/revenue view permission denied.");
}

export const listShipmentRevenueLedger = createServerFn({ method: "GET" }).handler(async () => {
  await requireView();
  const sql = await getSql();
  const shipments = await sql.query<Record<string, unknown>>(
    `select id,sales_order_id,plan_month,units,status,source_reference from vyndi_shipments order by plan_month,id`,
  );
  const invoices = await sql.query<Record<string, unknown>>(
    `select id,shipment_id,sales_order_id,plan_month,units,asp_lakh,amount_lakh,status,source_reference from vyndi_invoices order by plan_month,id`,
  );
  const collections = await sql.query<Record<string, unknown>>(
    `select id,invoice_id,plan_month,amount_lakh,status,source_reference from vyndi_collections order by plan_month,id`,
  );
  return {
    shipments: shipments.map((r) => ({ id:String(r.id),salesOrderId:String(r.sales_order_id),planMonth:Number(r.plan_month),units:Number(r.units),status:r.status as ShipmentRecord["status"],sourceReference:String(r.source_reference) })),
    invoices: invoices.map((r) => ({ id:String(r.id),shipmentId:String(r.shipment_id),salesOrderId:String(r.sales_order_id),planMonth:Number(r.plan_month),units:Number(r.units),aspLakh:Number(r.asp_lakh),amountLakh:Number(r.amount_lakh),status:r.status as InvoiceRecord["status"],sourceReference:String(r.source_reference) })),
    collections: collections.map((r) => ({ id:String(r.id),invoiceId:String(r.invoice_id),planMonth:Number(r.plan_month),amountLakh:Number(r.amount_lakh),status:r.status as CollectionRecord["status"],sourceReference:String(r.source_reference) })),
  };
});

/** @deprecated Shipment execution is Operations-owned; compatibility alias retained for current callers. */
export const postShipment = postDispatch;
/** @deprecated Shipment execution is Operations-owned; compatibility alias retained for current callers. */
export const reverseShipment = reverseDispatch;

export const issueInvoice = createServerFn({ method: "POST" })
  .validator(z.object({ id, shipmentId:id, sourceReference }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ invoice_id:string; amount_lakh:number|string }>(`select * from issue_vyndi_invoice($1,$2,$3,$4,$5)`,[data.id,data.shipmentId,data.sourceReference,actor.userId,actor.role]);
    if (!rows[0]) throw new Error("Invoice issue did not return a controlled record.");
    return { id:rows[0].invoice_id, amountLakh:Number(rows[0].amount_lakh) };
  });

export const voidInvoice = createServerFn({ method: "POST" })
  .validator(z.object({ id, reason:z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ revision:number|string }>(`select void_vyndi_invoice($1,$2,$3,$4) as revision`,[data.id,data.reason,actor.userId,actor.role]);
    return { id:data.id, revision:Number(rows[0]?.revision ?? 0) };
  });

export const postCollection = createServerFn({ method: "POST" })
  .validator(z.object({ id, invoiceId:id, planMonth:month, amountLakh:z.number().positive(), sourceReference }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ post_vyndi_collection:string }>(`select post_vyndi_collection($1,$2,$3,$4,$5,$6,$7)`,[data.id,data.invoiceId,data.planMonth,data.amountLakh,data.sourceReference,actor.userId,actor.role]);
    return { id:rows[0]?.post_vyndi_collection ?? data.id };
  });

export const reverseCollection = createServerFn({ method: "POST" })
  .validator(z.object({ id, reason:z.string().trim().min(1).max(500) }))
  .handler(async ({ data }) => {
    const actor = await requireBusinessActor("edit");
    const sql = await getSql();
    const rows = await sql.query<{ revision:number|string }>(`select reverse_vyndi_collection($1,$2,$3,$4) as revision`,[data.id,data.reason,actor.userId,actor.role]);
    return { id:data.id, revision:Number(rows[0]?.revision ?? 0) };
  });
