import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

/** Read-only adapter over canonical job cards + live reservation/ATP + eligible travellers. */
export const getProductionJobCardView = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Production view permission denied.");
  const sql = await getSql();
  const [cards, lines, travellers] = await Promise.all([
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
      select id,venture,model_id,model_name,sku,bom_revision,engineering_revision,serial_number,status
        from epr_travellers
       where status in ('released','in_build')
       order by model_name,bom_revision,serial_number
    `,
  ]);
  return { cards, lines, travellers };
});
