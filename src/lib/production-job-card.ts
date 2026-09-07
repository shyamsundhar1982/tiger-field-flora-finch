import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCommandRole } from "@/lib/command-access";
import { canPerform } from "@/lib/page-access";
import { BOM } from "@/lib/data/bom";
import type { BomTier } from "@/lib/finance/bom-engine";
import { validateConfiguration } from "@/lib/product-configuration";

const tierFor = (product: string): BomTier =>
  product === "aluminium" ? "core" : product === "premiumCarbon" ? "apex" : "pro";

function stageFor(item: string) {
  const value = item.toLowerCase();
  if (value.startsWith("frame") || value === "fork")
    return { no: 1, code: "RM", name: "Raw material & frame set", type: "raw_material" as const };
  if (value === "groupset" || value === "wheelset" || value.startsWith("tyres"))
    return { no: 2, code: "MC", name: "Major component kitting", type: "component" as const };
  if (value.startsWith("cockpit") || value.startsWith("saddle"))
    return { no: 3, code: "SA", name: "Sub-assembly & fit", type: "subassembly" as const };
  if (value.startsWith("assembly"))
    return { no: 4, code: "FA", name: "Final assembly", type: "operation" as const };
  return { no: 5, code: "QC", name: "QC, release & packaging", type: "operation" as const };
}

async function requireProductionWrite() {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "edit")) throw new Error("Production job-card permission denied.");
  return role;
}

export const createProductionJobCard = createServerFn({ method: "POST" })
  .validator(
    z.object({
      salesOrderId: z.string().min(1).max(100),
      productId: z.string().min(1).max(100),
      productLabel: z.string().min(1).max(200),
      units: z.number().positive(),
      dueMonth: z.number().int().min(1).max(36),
      status: z.enum(["planned", "released"]).default("released"),
      modelTier: z.enum(["core", "pro", "apex"]).optional(),
      variantId: z.string().min(1).max(100).optional(),
      configuration: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const role = await requireProductionWrite();
    const sql = await getSql();
    const existing =
      await sql`select id from epr_production_job_cards where sales_order_id=${data.salesOrderId} limit 1`;
    if (existing[0]) return { id: existing[0].id, created: false };

    const tier = data.modelTier ?? tierFor(data.productId);
    const configuredLines =
      data.variantId && data.configuration
        ? validateConfiguration(data.variantId, data.configuration)
        : null;
    const jobId = `JBC-${Date.now()}`;
    await sql`
      insert into epr_production_job_cards
        (id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,model_tier,variant_id,configuration)
      values
        (${jobId},${data.salesOrderId},${data.productId},${data.productLabel},${data.units},${tier},${data.dueMonth},${data.status},'operations',${role},${tier},${data.variantId ?? null},${JSON.stringify(data.configuration ?? {})}::jsonb)
    `;

    const physicalLines =
      configuredLines ??
      BOM.filter((line) => !["freight", "hs", "warranty"].includes(line.flag ?? ""));
    for (const [index, line] of physicalLines.entries()) {
      const itemName = "model" in line ? `${line.brand} ${line.model}` : line.item;
      const stage = stageFor("category" in line ? line.category : line.item);
      const quantity = data.units * ("quantityPerBike" in line ? line.quantityPerBike : 1);
      const sku = "sku" in line ? line.sku : null;
      const category = "category" in line ? line.category : null;
      const [balance] = sku
        ? await sql`select coalesce(sum(quantity_balance),0) as quantity from epr_authoritative_inventory_balance where venture='carbon' and sku=${sku}`
        : [{ quantity: 0 }];
      const available = Number(balance?.quantity ?? 0);
      const shortage = Math.max(quantity - available, 0);
      await sql`
        insert into epr_production_job_card_lines
          (id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,sku,category,available_quantity,shortage_quantity,issue_status)
        values
          (${`${jobId}-${index + 1}`},${jobId},${stage.no},${stage.code},${stage.name},${stage.type},${itemName},${quantity},'unit',${itemName},${sku},${category},${available},${shortage},${shortage > 0 ? "short" : data.status === "released" ? "reserved" : "pending"})
      `;
    }
    return { id: jobId, created: true };
  });

export const getProductionJobCards = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Production job-card permission denied.");
  const sql = await getSql();
  const cards = await sql`
    select id,sales_order_id,product_id,product_label,units,bom_tier,due_month,status,production_owner,created_by,model_tier,variant_id,configuration,created_at::text as created_at
    from epr_production_job_cards order by due_month asc, created_at desc limit 500
  `;
  const lines = await sql`
    select id,job_card_id,stage_no,stage_code,stage_name,line_type,item,quantity,unit,source_bom_line,issue_status,sku,category,available_quantity,shortage_quantity
    from epr_production_job_card_lines order by job_card_id,stage_no,id
  `;
  return { cards, lines };
});

export const getConfiguredDemandShortages = createServerFn({ method: "GET" }).handler(async () => {
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view"))
    throw new Error("Procurement shortage permission denied.");
  const sql = await getSql();
  return sql`
    select c.sales_order_id,c.product_label,c.variant_id,c.units,c.due_month,l.sku,l.category,l.item,l.quantity as required_quantity,l.available_quantity,l.shortage_quantity,l.unit
    from epr_production_job_card_lines l join epr_production_job_cards c on c.id=l.job_card_id
    where c.status not in ('complete','cancelled') and l.shortage_quantity > 0
    order by c.due_month,l.shortage_quantity desc,l.sku
  `;
});
