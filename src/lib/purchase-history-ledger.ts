import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql, type SqlRow } from "@/lib/db";
import { canPerform } from "@/lib/page-access";
import { getRouteMeta } from "@/lib/page-metadata";

async function requirePurchaseLedgerView() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view", getRouteMeta("/command/purchase-execution"))) {
    throw new Error("Purchase-history view permission denied.");
  }
}

export const getPurchaseHistoryData = createServerFn({ method: "GET" }).handler(async () => {
  await requirePurchaseLedgerView();
  const sql = await getSql();

  return sql.query<SqlRow>(`
    with receipt_summary as (
      select
        purchase_order_id,
        sum(quantity_received) as quantity_received,
        sum(quantity_accepted) as quantity_accepted,
        sum(quantity_quarantined) as quantity_quarantined,
        sum(quantity_rejected) as quantity_rejected,
        max(received_on)::text as last_received_on,
        string_agg(id, ', ' order by created_at, id) as grn_ids,
        string_agg(inventory_movement_id, ', ' order by created_at, id)
          filter (where inventory_movement_id is not null) as inventory_movement_ids
      from vyndi_goods_receipts
      group by purchase_order_id
    ),
    payment_summary as (
      select
        supplier_invoice_id,
        sum(amount_inr) as amount_paid_inr,
        max(paid_on)::text as last_paid_on
      from vyndi_supplier_payments
      group by supplier_invoice_id
    ),
    invoice_summary as (
      select
        i.purchase_order_id,
        count(*) filter (where i.status <> 'void') as invoice_count,
        string_agg(i.invoice_number, ', ' order by i.invoice_on, i.invoice_number)
          filter (where i.status <> 'void') as invoice_numbers,
        string_agg(i.status, ', ' order by i.invoice_on, i.invoice_number)
          filter (where i.status <> 'void') as invoice_statuses,
        sum(i.amount_ex_gst_inr) filter (where i.status <> 'void') as invoice_ex_gst_inr,
        sum(i.gst_inr) filter (where i.status <> 'void') as gst_inr,
        sum(i.amount_ex_gst_inr + i.gst_inr) filter (where i.status <> 'void') as invoice_total_inr,
        sum(coalesce(pay.amount_paid_inr, 0)) filter (where i.status <> 'void') as amount_paid_inr,
        max(i.due_on)::text filter (where i.status <> 'void') as latest_due_on,
        max(pay.last_paid_on) filter (where i.status <> 'void') as last_paid_on
      from vyndi_supplier_invoices i
      left join payment_summary pay on pay.supplier_invoice_id = i.id
      group by i.purchase_order_id
    )
    select
      p.id,
      p.supplier_id,
      s.name as supplier_name,
      p.source_action_id,
      p.requirement_month,
      p.sku,
      p.unit,
      p.quantity,
      p.unit_price_inr,
      p.quantity * p.unit_price_inr as order_value_inr,
      p.order_date::text as order_date,
      p.expected_receipt_on::text as expected_receipt_on,
      p.payment_terms_days,
      p.status,
      p.source_reference,
      p.notes,
      p.created_by,
      p.created_at::text as created_at,
      p.approved_by,
      p.approved_at::text as approved_at,
      p.issued_by,
      p.issued_at::text as issued_at,
      coalesce(r.quantity_received, 0) as quantity_received,
      coalesce(r.quantity_accepted, 0) as quantity_accepted,
      coalesce(r.quantity_quarantined, 0) as quantity_quarantined,
      coalesce(r.quantity_rejected, 0) as quantity_rejected,
      r.last_received_on,
      coalesce(r.grn_ids, '') as grn_ids,
      coalesce(r.inventory_movement_ids, '') as inventory_movement_ids,
      coalesce(i.invoice_count, 0) as invoice_count,
      coalesce(i.invoice_numbers, '') as invoice_numbers,
      coalesce(i.invoice_statuses, '') as invoice_statuses,
      coalesce(i.invoice_ex_gst_inr, 0) as invoice_ex_gst_inr,
      coalesce(i.gst_inr, 0) as gst_inr,
      coalesce(i.invoice_total_inr, 0) as invoice_total_inr,
      coalesce(i.amount_paid_inr, 0) as amount_paid_inr,
      greatest(coalesce(i.invoice_total_inr, 0) - coalesce(i.amount_paid_inr, 0), 0) as amount_open_inr,
      i.latest_due_on,
      i.last_paid_on
    from vyndi_purchase_orders p
    join vyndi_suppliers s on s.id = p.supplier_id
    left join receipt_summary r on r.purchase_order_id = p.id
    left join invoice_summary i on i.purchase_order_id = p.id
    order by p.order_date desc, p.created_at desc, p.id desc
  `);
});
