import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";

/** Read-only adapter over confirmed demand, canonical job cards, live ATP and linked traveller genealogy. */
export const getProductionJobCardView = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }) => {
  await requireBusinessActor(
    "view",
    context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
  );
  const sql = await getSql();
  const [orders, cards, lines, travellers] = await Promise.all([
    sql`
      select o.id,o.revision,o.plan_month,o.units,o.variant_id,o.variant_name,o.status,
             c.id as job_card_id,c.status as job_card_status,c.sales_order_revision as job_card_revision,
             c.batch_code,c.approved_at::text as job_card_approved_at
        from vyndi_sales_orders o
        left join epr_production_job_cards c on c.sales_order_id=o.id
       where o.status='confirmed'
       order by o.plan_month,o.id
    `,
    sql`
      select c.id,c.sales_order_id,c.sales_order_revision,c.product_id,c.product_label,c.units,c.bom_tier,c.due_month,c.status,
             c.production_owner,c.created_by,c.model_tier,c.variant_id,c.configuration,c.bom_revision,c.released_mapping_set,
             c.batch_code,c.approved_by,c.approved_at::text as approved_at,
             coalesce(p.po_draft_count,0)::int as po_draft_count,
             c.created_at::text as created_at,c.updated_at::text as updated_at
        from epr_production_job_cards c
        left join (
          select job_card_id,count(*) filter (where status='draft') as po_draft_count
            from vyndi_purchase_orders where auto_generated=true group by job_card_id
        ) p on p.job_card_id=c.id
       order by c.due_month asc,c.created_at desc limit 500
    `,
    sql`
      select l.id,l.job_card_id,l.stage_no,l.stage_code,l.stage_name,l.line_type,l.source_bom_line,
             l.sku,l.category,l.item,l.quantity,l.unit,l.bom_mapping_id,l.issue_status,
             r.id as reservation_id,r.status as reservation_status,r.quantity_reserved as reservation_quantity,
             r.reserved_by,r.reserved_at::text as reserved_at,r.consumed_by,r.consumed_at::text as consumed_at,
             coalesce(v.physical_quantity,0) as available_quantity,
             coalesce(v.reserved_quantity,0) as reserved_quantity,
             coalesce(v.available_to_promise,0) as available_to_promise,
             coalesce(v.shortage_quantity,l.quantity) as shortage_quantity
        from epr_production_job_card_lines l
        left join vyndi_live_job_card_requirements v on v.job_card_line_id=l.id
        left join lateral (
          select reservation.*
            from epr_inventory_reservations reservation
           where reservation.job_card_line_id=l.id
           order by reservation.reserved_at desc,reservation.id desc
           limit 1
        ) r on true
       order by l.job_card_id,l.stage_no,l.id
    `,
    sql`
      select t.id,t.venture,t.model_id,t.model_name,t.sku,t.bom_revision,t.engineering_revision,t.serial_number,t.status,
             t.supplier,t.job_card_id,t.job_card_revision,c.sales_order_id,c.product_label as job_card_product_label,
             t.created_by,t.created_at::text as created_at,t.updated_at::text as updated_at
        from epr_travellers t
        left join epr_production_job_cards c on c.id=t.job_card_id
       order by t.created_at desc,t.serial_number asc limit 500
    `,
  ]);

  // These columns are scalar database identifiers/labels. Normalize them at the
  // server boundary so the client never receives generic JsonValue for values
  // rendered by React or passed into the FIFO issue command.
  const normalizedTravellers = travellers.map((row) => ({
    id: String(row.id ?? ""),
    venture: String(row.venture ?? ""),
    model_id: String(row.model_id ?? ""),
    model_name: String(row.model_name ?? ""),
    sku: String(row.sku ?? ""),
    bom_revision: String(row.bom_revision ?? ""),
    engineering_revision: String(row.engineering_revision ?? ""),
    serial_number: String(row.serial_number ?? ""),
    status: String(row.status ?? ""),
    supplier: String(row.supplier ?? ""),
    job_card_id: String(row.job_card_id ?? ""),
    job_card_revision: Number(row.job_card_revision ?? 0),
    sales_order_id: String(row.sales_order_id ?? ""),
    job_card_product_label: String(row.job_card_product_label ?? ""),
    created_by: String(row.created_by ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));

  return { orders, cards, lines, travellers: normalizedTravellers };
});
