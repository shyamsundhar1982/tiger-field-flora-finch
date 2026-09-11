import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

export type OperatingLineageRow = {
  salesOrderId: string;
  salesOrderRevision: number;
  planMonth: number;
  units: number;
  variantId: string;
  variantName: string;
  orderStatus: string;
  jobCardId: string;
  jobCardRevision: number;
  jobCardStatus: string;
  bomRevision: string;
  batchCode: string;
  buildApprovedAt: string;
  requirementLines: number;
  shortageLines: number;
  shortageUnits: number;
  purchaseOrderCount: number;
  purchaseOrderIds: string;
  purchaseOrderStatuses: string;
  goodsReceiptCount: number;
  goodsReceiptIds: string;
  acceptedReceiptUnits: number;
  travellerCount: number;
  travellerIds: string;
  travellerStatuses: string;
  shipmentCount: number;
  shipmentIds: string;
  invoiceCount: number;
  invoiceIds: string;
  collectionCount: number;
  collectionIds: string;
  collectionAmountLakh: number;
};

const text = (value: unknown) => String(value ?? "");
const number = (value: unknown) => Number(value ?? 0);

/**
 * Read-only business-object genealogy across the canonical transactional chain.
 * No stage is inferred as complete unless a persisted record exists.
 * Quality is intentionally not joined here because the current Quality module does
 * not persist order/job-card-linked inspection evidence.
 */
export const getOperatingLineage = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );

    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(`
      select
        o.id as sales_order_id,
        o.revision as sales_order_revision,
        o.plan_month,
        o.units,
        o.variant_id,
        o.variant_name,
        o.status as order_status,
        c.id as job_card_id,
        c.sales_order_revision as job_card_revision,
        c.status as job_card_status,
        c.bom_revision,
        c.batch_code,
        c.approved_at::text as build_approved_at,
        coalesce(req.requirement_lines,0)::int as requirement_lines,
        coalesce(req.shortage_lines,0)::int as shortage_lines,
        coalesce(req.shortage_units,0) as shortage_units,
        coalesce(po.po_count,0)::int as purchase_order_count,
        coalesce(po.po_ids,'') as purchase_order_ids,
        coalesce(po.po_statuses,'') as purchase_order_statuses,
        coalesce(grn.grn_count,0)::int as goods_receipt_count,
        coalesce(grn.grn_ids,'') as goods_receipt_ids,
        coalesce(grn.accepted_units,0) as accepted_receipt_units,
        coalesce(tr.traveller_count,0)::int as traveller_count,
        coalesce(tr.traveller_ids,'') as traveller_ids,
        coalesce(tr.traveller_statuses,'') as traveller_statuses,
        coalesce(sh.shipment_count,0)::int as shipment_count,
        coalesce(sh.shipment_ids,'') as shipment_ids,
        coalesce(inv.invoice_count,0)::int as invoice_count,
        coalesce(inv.invoice_ids,'') as invoice_ids,
        coalesce(col.collection_count,0)::int as collection_count,
        coalesce(col.collection_ids,'') as collection_ids,
        coalesce(col.collection_amount_lakh,0) as collection_amount_lakh
      from vyndi_sales_orders o
      left join lateral (
        select jc.*
          from epr_production_job_cards jc
         where jc.sales_order_id=o.id
           and jc.sales_order_revision=o.revision
         order by jc.updated_at desc,jc.created_at desc,jc.id desc
         limit 1
      ) c on true
      left join lateral (
        select
          count(*) filter (where r.sku is not null)::int as requirement_lines,
          count(*) filter (where r.sku is not null and r.shortage_quantity>0)::int as shortage_lines,
          coalesce(sum(r.shortage_quantity) filter (where r.sku is not null and r.shortage_quantity>0),0) as shortage_units
        from vyndi_live_job_card_requirements r
        where r.job_card_id=c.id
      ) req on true
      left join lateral (
        select
          count(*)::int as po_count,
          string_agg(p.id, ', ' order by p.created_at,p.id) as po_ids,
          string_agg(p.status, ', ' order by p.created_at,p.id) as po_statuses
        from vyndi_purchase_orders p
        where p.job_card_id=c.id and p.status<>'cancelled'
      ) po on true
      left join lateral (
        select
          count(*)::int as grn_count,
          string_agg(g.id, ', ' order by g.created_at,g.id) as grn_ids,
          coalesce(sum(g.quantity_accepted),0) as accepted_units
        from vyndi_goods_receipts g
        join vyndi_purchase_orders p on p.id=g.purchase_order_id
        where p.job_card_id=c.id and p.status<>'cancelled'
      ) grn on true
      left join lateral (
        select
          count(*) filter (where t.status<>'rejected')::int as traveller_count,
          string_agg(t.id, ', ' order by t.created_at,t.id) filter (where t.status<>'rejected') as traveller_ids,
          string_agg(t.status, ', ' order by t.created_at,t.id) filter (where t.status<>'rejected') as traveller_statuses
        from epr_travellers t
        where t.job_card_id=c.id
      ) tr on true
      left join lateral (
        select
          count(*) filter (where s.status='posted')::int as shipment_count,
          string_agg(s.id, ', ' order by s.plan_month,s.id) filter (where s.status='posted') as shipment_ids
        from vyndi_shipments s
        where s.sales_order_id=o.id
      ) sh on true
      left join lateral (
        select
          count(*) filter (where i.status='issued')::int as invoice_count,
          string_agg(i.id, ', ' order by i.plan_month,i.id) filter (where i.status='issued') as invoice_ids
        from vyndi_invoices i
        where i.sales_order_id=o.id
      ) inv on true
      left join lateral (
        select
          count(*) filter (where c2.status='posted')::int as collection_count,
          string_agg(c2.id, ', ' order by c2.plan_month,c2.id) filter (where c2.status='posted') as collection_ids,
          coalesce(sum(c2.amount_lakh) filter (where c2.status='posted'),0) as collection_amount_lakh
        from vyndi_collections c2
        join vyndi_invoices i2 on i2.id=c2.invoice_id
        where i2.sales_order_id=o.id and i2.status='issued'
      ) col on true
      where o.status in ('confirmed','delivered')
      order by o.plan_month,o.id
    `);

    return rows.map((row): OperatingLineageRow => ({
      salesOrderId: text(row.sales_order_id),
      salesOrderRevision: number(row.sales_order_revision),
      planMonth: number(row.plan_month),
      units: number(row.units),
      variantId: text(row.variant_id),
      variantName: text(row.variant_name),
      orderStatus: text(row.order_status),
      jobCardId: text(row.job_card_id),
      jobCardRevision: number(row.job_card_revision),
      jobCardStatus: text(row.job_card_status),
      bomRevision: text(row.bom_revision),
      batchCode: text(row.batch_code),
      buildApprovedAt: text(row.build_approved_at),
      requirementLines: number(row.requirement_lines),
      shortageLines: number(row.shortage_lines),
      shortageUnits: number(row.shortage_units),
      purchaseOrderCount: number(row.purchase_order_count),
      purchaseOrderIds: text(row.purchase_order_ids),
      purchaseOrderStatuses: text(row.purchase_order_statuses),
      goodsReceiptCount: number(row.goods_receipt_count),
      goodsReceiptIds: text(row.goods_receipt_ids),
      acceptedReceiptUnits: number(row.accepted_receipt_units),
      travellerCount: number(row.traveller_count),
      travellerIds: text(row.traveller_ids),
      travellerStatuses: text(row.traveller_statuses),
      shipmentCount: number(row.shipment_count),
      shipmentIds: text(row.shipment_ids),
      invoiceCount: number(row.invoice_count),
      invoiceIds: text(row.invoice_ids),
      collectionCount: number(row.collection_count),
      collectionIds: text(row.collection_ids),
      collectionAmountLakh: number(row.collection_amount_lakh),
    }));
  });
