import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

/** Read-only adapter over confirmed demand, canonical job cards, live ATP and linked traveller genealogy. */
export const getProductionJobCardView = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Production view permission denied.");
  const sql = await getSql();
  const [orders, cards, lines, travellers] = await Promise.all([
    sql`
      select o.id,o.revision,o.plan_month,o.units,o.variant_id,o.variant_name,o.status,
             c.id as job_card_id,c.status as job_card_status,c.sales_order_revision as job_card_revision
        from vyndi_sales_orders o
        left join epr_production_job_cards c on c.sales_order_id=o.id
       where o.status='confirmed'
       order by o.plan_month,o.id
    `,
    sql`
      select id,sales_order_id,sales_order_revision,product_id,product_label,units,bom_tier,due_month,status,
             production_owner,created_by,model_tier,variant_id,configuration,bom_revision,released_mapping_set,
             created_at::text as created_at,updated_at::text as updated_at
        from epr_production_job_cards
       order by due_month asc,created_at desc limit 500
    `,
    sql`
      select l.id,l.job_card_id,l.stage_no,l.stage_code,l.stage_name,l.line_type,l.source_bom_line,
             l.sku,l.category,l.item,l.quantity,l.unit,l.bom_mapping_id,l.issue_status,
             r.id as reservation_id,
             coalesce(v.physical_quantity,0) as available_quantity,
             coalesce(v.reserved_quantity,0) as reserved_quantity,
             coalesce(v.available_to_promise,0) as available_to_promise,
             coalesce(v.shortage_quantity,l.quantity) as shortage_quantity
        from epr_production_job_card_lines l
        left join vyndi_live_job_card_requirements v on v.job_card_line_id=l.id
        left join epr_inventory_reservations r on r.job_card_line_id=l.id and r.status='active'
       order by l.job_card_id,l.stage_no,l.id
    `,
    sql`
      select t.id,t.venture,t.model_id,t.model_name,t.sku,t.bom_revision,t.engineering_revision,t.serial_number,t.status,
             t.supplier,t.job_card_id,t.job_card_revision,c.sales_order_id,c.product_label as job_card_product_label,
             t.created_by,t.created_at::text as created_at,t.updated_at::text as updated_at
        from epr_travellers t
        left join epr_production_job_cards c on c.id=t.job_card_id
       order by t.created_at desc,t.serial_number asc limit 250
    `,
  ]);
  return { orders, cards, lines, travellers };
});
