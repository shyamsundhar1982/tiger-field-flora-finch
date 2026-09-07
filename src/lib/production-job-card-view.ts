import { createServerFn } from "@tanstack/react-start";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

/** Read-only adapter over canonical job cards + live reservation/ATP view. */
export const getProductionJobCardView = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Production view permission denied.");
  const sql = await getSql();
  const cards = await sql`
    select id,sales_order_id,sales_order_revision,product_id,product_label,units,bom_tier,due_month,status,
           production_owner,created_by,model_tier,variant_id,configuration,bom_revision,released_mapping_set,
           created_at::text as created_at,updated_at::text as updated_at
      from epr_production_job_cards
     order by due_month asc,created_at desc limit 500
  `;
  const lines = await sql`
    select l.id,l.job_card_id,l.stage_no,l.stage_code,l.stage_name,l.line_type,l.source_bom_line,
           l.sku,l.category,l.item,l.quantity,l.unit,l.bom_mapping_id,l.issue_status,
           coalesce(v.physical_quantity,0) as available_quantity,
           coalesce(v.reserved_quantity,0) as reserved_quantity,
           coalesce(v.available_to_promise,0) as available_to_promise,
           coalesce(v.shortage_quantity,l.quantity) as shortage_quantity
      from epr_production_job_card_lines l
      left join vyndi_live_job_card_requirements v on v.job_card_line_id=l.id
     order by l.job_card_id,l.stage_no,l.id
  `;
  return { cards, lines };
});
